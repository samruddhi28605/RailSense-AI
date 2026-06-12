"""
RailSense AI — main.py
═══════════════════════════════════════════════════════════════
THE COMPLETE BACKEND — All agents, APIs, WebSocket in one file.

How it works:
  1. Server starts → background loop begins every 2 seconds
  2. Loop: simulator generates sensor data for 3 trains
  3. Monitor Agent checks each reading against thresholds
  4. If flagged → Anomaly Agent (Claude AI) classifies severity
  5. If anomaly → Response Agent generates actions
  6. Everything saved to JSON + broadcast via WebSocket to dashboard
  7. Dashboard updates live without any page refresh

Run: python main.py
═══════════════════════════════════════════════════════════════
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
import json
import uuid
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

# ── Import our modules ───────────────────────────────────────
from agents.monitor_agent  import MonitorAgent
from agents.anomaly_agent  import AnomalyAgent
from agents.response_agent import ResponseAgent
from simulator.sensor_simulator import generate_all, inject_fault, TRAINS
import database as db

# ── Initialise agents (singletons) ──────────────────────────
monitor_agent  = MonitorAgent()
anomaly_agent  = AnomalyAgent()
response_agent = ResponseAgent()

print("[RailSense] ✓ MonitorAgent  ready")
print("[RailSense] ✓ AnomalyAgent  ready")
print("[RailSense] ✓ ResponseAgent ready")


# ════════════════════════════════════════════════════════════
# WEBSOCKET MANAGER
# Keeps a list of all connected browser clients.
# Broadcasts JSON to every client simultaneously.
# ════════════════════════════════════════════════════════════
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"[WS] +1 client  (total={len(self.active)})")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        print(f"[WS] -1 client  (total={len(self.active)})")

    async def broadcast(self, data: dict):
        """Push JSON to ALL connected dashboard clients."""
        msg  = json.dumps(data)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.disconnect(d)

    async def send_one(self, ws: WebSocket, data: dict):
        await ws.send_text(json.dumps(data))


ws_manager = ConnectionManager()


# ════════════════════════════════════════════════════════════
# BACKGROUND SENSOR LOOP
# Runs forever every 2 seconds.
# This is where all 3 agents are orchestrated.
# ════════════════════════════════════════════════════════════
async def sensor_loop():
    print("[SensorLoop] ✓ Started — processing every 2 seconds")
    scan_count = 0

    while True:
        scan_count += 1
        readings = generate_all()          # get fresh data for all 3 trains

        new_anomalies = []
        new_logs      = []
        ts            = datetime.utcnow().isoformat()

        for reading in readings:
            # ── Save latest train position ────────────────────
            db.upsert_train(reading)

            # ── MONITOR AGENT ─────────────────────────────────
            flagged = monitor_agent.monitor(reading)

            monitor_log = {
                "id":        f"log-{uuid.uuid4().hex[:8]}",
                "agent":     "MonitorAgent",
                "message":   monitor_agent.log_message(reading),
                "timestamp": ts,
                "anomaly_id": None
            }
            db.save_log(monitor_log)
            new_logs.append(monitor_log)

            if flagged:
                # ── ANOMALY AGENT ──────────────────────────────
                t0     = time.time()
                report = anomaly_agent.analyze(reading)
                elapsed_ms = int((time.time() - t0) * 1000)

                alert_id = f"ANM-{uuid.uuid4().hex[:8].upper()}"
                alert = {
                    "id":          alert_id,
                    "timestamp":   ts,
                    "severity":    report["severity"],
                    "risk_score":  report["risk_score"],
                    "issue":       report["issue"],
                    "location":    report.get("location", reading["location"]),
                    "action":      report["action"],
                    "description": report.get("description", report["action"]),
                    "train_id":    reading["train_id"],
                    "resolved":    False,
                    "source":      "sensor_pipeline",
                    "response_ms": elapsed_ms,
                }
                db.save_alert(alert)
                new_anomalies.append(alert)

                anomaly_log = {
                    "id":        f"log-{uuid.uuid4().hex[:8]}",
                    "agent":     "AnomalyAgent",
                    "message":   f"Classified as {report['severity']} — {report['issue']} (AI took {elapsed_ms}ms)",
                    "timestamp": ts,
                    "anomaly_id": alert_id
                }
                db.save_log(anomaly_log)
                new_logs.append(anomaly_log)

                # ── RESPONSE AGENT ────────────────────────────
                response    = response_agent.respond(report)
                actions_str = response_agent.format_response_actions(response)

                incident = {
                    "id":          f"INC-{uuid.uuid4().hex[:8].upper()}",
                    "created_at":  ts,
                    "severity":    report["severity"],
                    "issue":       report["issue"],
                    "location":    report.get("location", reading["location"]),
                    "alert_id":    alert_id,
                    "status":      "OPEN",
                    "response":    response,
                }
                db.save_incident(incident)

                resp_log = {
                    "id":        f"log-{uuid.uuid4().hex[:8]}",
                    "agent":     "ResponseAgent",
                    "message":   response["alert"],
                    "timestamp": ts,
                    "anomaly_id": alert_id
                }
                db.save_log(resp_log)
                new_logs.append(resp_log)

                print(f"[Pipeline] {alert_id} | {report['severity']} | {reading['train_id']} | {elapsed_ms}ms")

                # Broadcast fault pipeline event
                await ws_manager.broadcast({
                    "type":             "fault_injection",
                    "fault_type":       "sensor_detected",
                    "alert":            alert,
                    "logs":             [anomaly_log, resp_log],
                    "incident":         incident,
                    "response_actions": actions_str
                })

        # ── Broadcast periodic train + log update ─────────────
        await ws_manager.broadcast({
            "type":          "train_update_batch",
            "trains":        db.get_all_trains(),
            "new_anomalies": new_anomalies,
            "new_logs":      new_logs[-6:],
            "stats":         db.get_agent_stats(),
            "network":       db.get_network_health(),
            "scan":          scan_count,
        })

        await asyncio.sleep(2)


# ════════════════════════════════════════════════════════════
# FASTAPI APP
# ════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(sensor_loop())
    yield
    task.cancel()


app = FastAPI(
    title="RailSense AI",
    description="Autonomous Railway Safety & Operations Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ════════════════════════════════════════════════════════════
# PYDANTIC REQUEST MODELS
# ════════════════════════════════════════════════════════════
class FaultInjectRequest(BaseModel):
    fault_type: str              # track | signal | overspeed | crowd | comm | sensor
    location:   Optional[str] = None
    train_id:   Optional[str] = "T101"

class SensorDataRequest(BaseModel):
    train_id:    str
    temperature: float
    vibration:   float
    signal:      str
    speed:       int
    crowding:    int = 50


# ════════════════════════════════════════════════════════════
# REST ENDPOINTS
# ════════════════════════════════════════════════════════════

# ── Health ───────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {
        "status":     "online",
        "system":     "RailSense AI",
        "timestamp":  datetime.utcnow().isoformat(),
        "ws_clients": len(ws_manager.active),
        "agents":     ["MonitorAgent", "AnomalyAgent", "ResponseAgent"],
    }


# ── Trains ───────────────────────────────────────────────────
@app.get("/trains", tags=["Trains"])
async def get_trains():
    """Latest position + sensor data for all 3 trains."""
    return db.get_all_trains()

@app.post("/trains/update", tags=["Trains"])
async def update_train(data: dict):
    """Simulator pushes train position here."""
    db.upsert_train(data)
    await ws_manager.broadcast({"type": "train_update", "data": data})
    return {"status": "ok"}


# ── Anomalies ────────────────────────────────────────────────
@app.get("/anomalies", tags=["Anomalies"])
async def get_anomalies(limit: int = 50):
    alerts = db.get_all_alerts()
    return sorted(alerts, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]

@app.post("/anomalies", tags=["Anomalies"])
async def post_anomaly(data: dict):
    """Agents can POST anomalies directly."""
    data.setdefault("id",        str(uuid.uuid4()))
    data.setdefault("timestamp", datetime.utcnow().isoformat())
    data.setdefault("resolved",  False)
    db.save_alert(data)
    await ws_manager.broadcast({"type": "new_anomaly", "data": data})
    return data

@app.patch("/anomalies/{alert_id}/resolve", tags=["Anomalies"])
async def resolve_anomaly(alert_id: str):
    ok = db.resolve_alert(alert_id)
    if not ok:
        raise HTTPException(404, "Alert not found")
    await ws_manager.broadcast({"type": "alert_resolved", "alert_id": alert_id})
    return {"status": "resolved", "alert_id": alert_id}


# ── Agent Logs ───────────────────────────────────────────────
@app.get("/agents/log", tags=["Agents"])
async def get_logs(limit: int = 100):
    logs = db.get_all_logs()
    return sorted(logs, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]

@app.post("/agents/log", tags=["Agents"])
async def post_log(data: dict):
    data.setdefault("id",        str(uuid.uuid4()))
    data.setdefault("timestamp", datetime.utcnow().isoformat())
    db.save_log(data)
    await ws_manager.broadcast({"type": "agent_log", "data": data})
    return data

@app.get("/agents/stats", tags=["Agents"])
async def get_stats():
    return db.get_agent_stats()

@app.post("/agents/stats/update", tags=["Agents"])
async def update_stats(data: dict):
    db.update_agent_stats(data)
    await ws_manager.broadcast({"type": "agent_stats", "data": data})
    return {"status": "ok"}


# ── Incidents ────────────────────────────────────────────────
@app.get("/incidents", tags=["Incidents"])
async def get_incidents():
    return db.get_all_incidents()

@app.post("/incidents", tags=["Incidents"])
async def post_incident(data: dict):
    data.setdefault("id",         str(uuid.uuid4()))
    data.setdefault("created_at", datetime.utcnow().isoformat())
    data.setdefault("status",     "OPEN")
    db.save_incident(data)
    return data


# ── Network Health ───────────────────────────────────────────
@app.get("/network/health", tags=["Network"])
async def get_health():
    return db.get_network_health()

@app.post("/network/health", tags=["Network"])
async def post_health(data: dict):
    db.update_network_health(data)
    await ws_manager.broadcast({"type": "network_health", "data": data})
    return {"status": "ok"}


# ── Sensor Data (direct from simulator) ──────────────────────
@app.post("/sensor/data", tags=["Simulator"])
async def receive_sensor(data: SensorDataRequest):
    """
    Member 4's simulator can POST raw data here.
    Backend runs Monitor + Anomaly logic automatically.
    """
    reading = data.model_dump()
    db.upsert_train({**reading, "lat": 0, "lng": 0, "status": "NORMAL"})

    flagged = monitor_agent.monitor(reading)
    if not flagged:
        return {"flagged": False, "status": "normal"}

    report   = anomaly_agent.analyze(reading)
    response = response_agent.respond(report)
    alert_id = str(uuid.uuid4())

    alert = {
        "id":         alert_id,
        "timestamp":  datetime.utcnow().isoformat(),
        "resolved":   False,
        "train_id":   data.train_id,
        "source":     "direct_sensor",
        **report
    }
    db.save_alert(alert)
    db.save_incident({
        "id":         str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat(),
        "alert_id":   alert_id,
        "status":     "OPEN",
        **report
    })

    await ws_manager.broadcast({
        "type":             "fault_injection",
        "fault_type":       "sensor_detected",
        "alert":            alert,
        "logs":             [],
        "incident":         {},
        "response_actions": response_agent.format_response_actions(response),
    })
    return {"flagged": True, "severity": report["severity"], "alert_id": alert_id}


# ════════════════════════════════════════════════════════════
# FAULT INJECTION  🔴 THE DEMO ENDPOINT
# Simulates full pipeline: fault → agents → alert → broadcast
# Called by dashboard fault buttons
# ════════════════════════════════════════════════════════════
FAULT_CONFIGS = {
    "track":     {"temperature": 88, "vibration": 96, "signal": "GREEN", "speed": 85,  "crowding": 50},
    "signal":    {"temperature": 45, "vibration": 20, "signal": "FAULT", "speed": 90,  "crowding": 50},
    "overspeed": {"temperature": 55, "vibration": 60, "signal": "GREEN", "speed": 160, "crowding": 40},
    "crowd":     {"temperature": 50, "vibration": 35, "signal": "GREEN", "speed": 70,  "crowding": 98},
    "comm":      {"temperature": 48, "vibration": 25, "signal": "YELLOW","speed": 80,  "crowding": 55},
    "sensor":    {"temperature": 40, "vibration": 15, "signal": "RED",   "speed": 75,  "crowding": 30},
}

FAULT_LOCATIONS = {
    "track":     "Pune Division, KM 847",
    "signal":    "Delhi-Agra Corridor",
    "overspeed": "Bengaluru Suburban Sector",
    "crowd":     "Mumbai CST Platform 4",
    "comm":      "Kolkata Sector 7",
    "sensor":    "Hyderabad Junction",
}

@app.post("/fault/inject", tags=["Demo"])
async def fault_inject(body: FaultInjectRequest):
    """
    ╔════════════════════════════════════════╗
    ║  HACKATHON DEMO ENDPOINT               ║
    ║  Click fault button → full pipeline    ║
    ║  fires in <5 seconds on dashboard      ║
    ╚════════════════════════════════════════╝
    """
    if body.fault_type not in FAULT_CONFIGS:
        raise HTTPException(400, f"Unknown fault type. Choose: {list(FAULT_CONFIGS.keys())}")

    cfg      = FAULT_CONFIGS[body.fault_type]
    location = body.location or FAULT_LOCATIONS.get(body.fault_type, "India Rail Network")
    ts       = datetime.utcnow().isoformat()
    t0       = time.time()

    sensor = {**cfg, "train_id": body.train_id}

    # ── Run full agent pipeline ───────────────────────────────
    report   = anomaly_agent.analyze(sensor)
    response = response_agent.respond(report)
    elapsed  = round(time.time() - t0, 2)

    alert_id = f"ANM-{uuid.uuid4().hex[:8].upper()}"
    alert = {
        "id":          alert_id,
        "timestamp":   ts,
        "severity":    report["severity"],
        "risk_score":  report["risk_score"],
        "issue":       report["issue"],
        "location":    location,
        "action":      report["action"],
        "description": report.get("description", report["action"]),
        "train_id":    body.train_id,
        "resolved":    False,
        "source":      "fault_injection",
    }
    db.save_alert(alert)

    # ── Build agent log entries ───────────────────────────────
    logs = [
        {"id": str(uuid.uuid4()), "timestamp": ts, "agent": "MonitorAgent",
         "message": f"Anomalous sensor reading detected at {location}", "anomaly_id": alert_id},
        {"id": str(uuid.uuid4()), "timestamp": ts, "agent": "AnomalyAgent",
         "message": f"Classified as {report['severity']} — {report['issue']} (Claude AI, {int(elapsed*1000)}ms)", "anomaly_id": alert_id},
        {"id": str(uuid.uuid4()), "timestamp": ts, "agent": "ResponseAgent",
         "message": response["alert"], "anomaly_id": alert_id},
    ]
    for log in logs:
        db.save_log(log)

    incident = {
        "id":         f"INC-{uuid.uuid4().hex[:8].upper()}",
        "created_at": ts,
        "severity":   report["severity"],
        "issue":      report["issue"],
        "location":   location,
        "alert_id":   alert_id,
        "status":     "OPEN",
    }
    db.save_incident(incident)

    actions = response_agent.format_response_actions(response)

    # ── Broadcast to all dashboard clients ────────────────────
    await ws_manager.broadcast({
        "type":             "fault_injection",
        "fault_type":       body.fault_type,
        "alert":            alert,
        "logs":             logs,
        "incident":         incident,
        "response_actions": actions,
    })

    print(f"[FaultInject] {body.fault_type} → {report['severity']} | pipeline={elapsed}s | ws_clients={len(ws_manager.active)}")

    return {
        "status":                "injected",
        "alert_id":              alert_id,
        "severity":              report["severity"],
        "risk_score":            report["risk_score"],
        "pipeline_fired":        ["MonitorAgent", "AnomalyAgent", "ResponseAgent"],
        "response_time_seconds": elapsed,
        "response_actions":      actions,
        "ws_clients_notified":   len(ws_manager.active),
    }


# ════════════════════════════════════════════════════════════
# WEBSOCKET ENDPOINT
# ws://localhost:8000/ws
# Dashboard connects here once and receives all live updates.
# ════════════════════════════════════════════════════════════
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send current state immediately on connect
        await ws_manager.send_one(websocket, {
            "type":        "connected",
            "message":     "RailSense AI WebSocket connected ✓",
            "timestamp":   datetime.utcnow().isoformat(),
            "trains":      db.get_all_trains(),
            "anomalies":   db.get_all_alerts()[:20],
            "logs":        db.get_all_logs()[:30],
            "stats":       db.get_agent_stats(),
            "network":     db.get_network_health(),
        })

        # Keep connection alive — handle ping/pong
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if msg == "ping":
                    await ws_manager.send_one(websocket, {"type": "pong"})
            except asyncio.TimeoutError:
                # Send heartbeat every 30s to prevent connection drop
                await ws_manager.send_one(websocket, {
                    "type":      "heartbeat",
                    "timestamp": datetime.utcnow().isoformat()
                })

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ════════════════════════════════════════════════════════════
# START SERVER
# ════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    print("\n" + "═"*55)
    print("  RailSense AI — Backend Server")
    print("  API Docs:  http://localhost:8000/docs")
    print("  Health:    http://localhost:8000/health")
    print("  WebSocket: ws://localhost:8000/ws")
    print("═"*55 + "\n")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )
