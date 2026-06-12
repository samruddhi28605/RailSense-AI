"""
database.py
───────────
Dual-mode database:
  • USE_FIREBASE=false → JSON files in /data/ (default, zero setup)
  • USE_FIREBASE=true  → Firebase Realtime Database (set after Step 3)

Switch modes by changing USE_FIREBASE in your .env file.
Everything else in the project stays the same.
"""

import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

USE_FIREBASE     = os.getenv("USE_FIREBASE", "false").lower() == "true"
FIREBASE_DB_URL  = os.getenv("FIREBASE_DB_URL", "")
FIREBASE_CRED    = os.getenv("FIREBASE_CRED_PATH", "serviceAccountKey.json")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# ── Firebase init ────────────────────────────────────────────
_fdb = None   # Firebase db reference (None if not using Firebase)

if USE_FIREBASE:
    try:
        import firebase_admin
        from firebase_admin import credentials, db as firebase_db

        cred_path = os.path.join(os.path.dirname(__file__), FIREBASE_CRED)

        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DB_URL})

        _fdb = firebase_db
        print(f"[DB] ✓ Firebase connected → {FIREBASE_DB_URL}")

    except FileNotFoundError:
        print(f"[DB] ✗ serviceAccountKey.json not found at {cred_path}")
        print("[DB]   → Falling back to JSON files")
        USE_FIREBASE = False
    except Exception as e:
        print(f"[DB] ✗ Firebase error: {e}")
        print("[DB]   → Falling back to JSON files")
        USE_FIREBASE = False
else:
    print("[DB] ✓ JSON file storage active (set USE_FIREBASE=true to enable Firebase)")

# ── In-memory caches (used in JSON mode AND as fast read cache in Firebase mode) ─
_trains:    dict = {}
_alerts:    list = []
_logs:      list = []
_incidents: list = []

_network_health = {
    "track": 97.8, "signal": 96.2, "safety": 98.5,
    "ops":   95.1, "emergency": 99.0, "ai": 99.7
}

_agent_stats = {
    "monitor":  {"sensors_watched": 126, "events_per_hour": 4563, "uptime": 99.9,  "confidence": 98.2},
    "anomaly":  {"critical": 0, "high": 0, "medium": 0, "low": 0, "confidence": 94.7},
    "response": {"maintenance_dispatches": 0, "driver_advisories": 0, "emergency_actions": 0, "readiness": 96.1}
}


# ════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════

def _save_json(filename: str, data):
    """Write data to a local JSON file."""
    with open(os.path.join(DATA_DIR, filename), "w") as f:
        json.dump(data, f, indent=2)


def _fb_set(path: str, data):
    """Write a value to Firebase at the given path."""
    _fdb.reference(path).set(data)


def _fb_push(path: str, data):
    """Push a new entry to a Firebase list. Returns the new key."""
    return _fdb.reference(path).push(data)


def _fb_get(path: str):
    """Read a value from Firebase. Returns None if empty."""
    return _fdb.reference(path).get()


def _fb_update(path: str, data: dict):
    """Update specific fields at a Firebase path."""
    _fdb.reference(path).update(data)


# ════════════════════════════════════════════════════════════
# TRAINS
# ════════════════════════════════════════════════════════════

def upsert_train(train: dict):
    """Save or update a train. Keyed by train_id."""
    tid = train.get("train_id", train.get("id", "unknown"))
    _trains[tid] = train

    if USE_FIREBASE:
        _fb_set(f"trains/{tid}", train)
    else:
        _save_json("trains.json", list(_trains.values()))


def get_all_trains() -> list:
    """Get latest data for all trains."""
    if USE_FIREBASE and not _trains:
        # Cold start — load from Firebase
        data = _fb_get("trains")
        if data:
            if isinstance(data, dict):
                return list(data.values())
            return data
    return list(_trains.values())


# ════════════════════════════════════════════════════════════
# ALERTS / ANOMALIES
# ════════════════════════════════════════════════════════════

def save_alert(alert: dict):
    """Save a new alert or update an existing one."""
    # Update in-memory cache
    for i, a in enumerate(_alerts):
        if a.get("id") == alert.get("id"):
            _alerts[i] = alert
            if USE_FIREBASE:
                _fb_set(f"alerts/{alert['id']}", alert)
            else:
                _save_json("alerts.json", _alerts)
            return

    _alerts.insert(0, alert)
    if len(_alerts) > 100:
        _alerts.pop()

    if USE_FIREBASE:
        _fb_set(f"alerts/{alert['id']}", alert)
    else:
        _save_json("alerts.json", _alerts)

    # Update anomaly count in agent stats
    sev = alert.get("severity", "low").lower()
    if sev in _agent_stats["anomaly"]:
        _agent_stats["anomaly"][sev] += 1
    if USE_FIREBASE:
        _fb_set("agent_stats", _agent_stats)
    else:
        _save_json("agent_stats.json", _agent_stats)


def get_all_alerts() -> list:
    """Get all alerts, newest first."""
    if USE_FIREBASE and not _alerts:
        data = _fb_get("alerts")
        if data:
            items = list(data.values()) if isinstance(data, dict) else data
            return sorted(items, key=lambda x: x.get("timestamp", ""), reverse=True)
    return _alerts


def resolve_alert(alert_id: str) -> bool:
    """Mark an alert as resolved."""
    for a in _alerts:
        if a.get("id") == alert_id:
            a["resolved"]    = True
            a["resolved_at"] = datetime.utcnow().isoformat()
            if USE_FIREBASE:
                _fb_update(f"alerts/{alert_id}", {
                    "resolved":    True,
                    "resolved_at": a["resolved_at"]
                })
            else:
                _save_json("alerts.json", _alerts)
            return True
    return False


# ════════════════════════════════════════════════════════════
# AGENT LOGS
# ════════════════════════════════════════════════════════════

def save_log(log: dict):
    """Save an agent activity log entry."""
    _logs.insert(0, log)
    if len(_logs) > 200:
        _logs.pop()

    if USE_FIREBASE:
        _fb_set(f"logs/{log['id']}", log)
    else:
        _save_json("logs.json", _logs)


def get_all_logs() -> list:
    """Get all agent logs, newest first."""
    if USE_FIREBASE and not _logs:
        data = _fb_get("logs")
        if data:
            items = list(data.values()) if isinstance(data, dict) else data
            return sorted(items, key=lambda x: x.get("timestamp", ""), reverse=True)
    return _logs


# ════════════════════════════════════════════════════════════
# INCIDENTS
# ════════════════════════════════════════════════════════════

def save_incident(incident: dict):
    """Save a full incident report."""
    _incidents.insert(0, incident)
    if len(_incidents) > 100:
        _incidents.pop()

    if USE_FIREBASE:
        _fb_set(f"incidents/{incident['id']}", incident)
    else:
        _save_json("incidents.json", _incidents)

    # Update response agent dispatch counts
    sev = incident.get("severity", "LOW")
    if sev == "CRITICAL":
        _agent_stats["response"]["emergency_actions"]      += 1
    if sev in ("HIGH", "CRITICAL"):
        _agent_stats["response"]["maintenance_dispatches"] += 1
    _agent_stats["response"]["driver_advisories"] += 1

    if USE_FIREBASE:
        _fb_set("agent_stats", _agent_stats)
    else:
        _save_json("agent_stats.json", _agent_stats)


def get_all_incidents() -> list:
    """Get all incidents."""
    if USE_FIREBASE and not _incidents:
        data = _fb_get("incidents")
        if data:
            items = list(data.values()) if isinstance(data, dict) else data
            return sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)
    return _incidents


# ════════════════════════════════════════════════════════════
# NETWORK HEALTH
# ════════════════════════════════════════════════════════════

def get_network_health() -> dict:
    if USE_FIREBASE:
        data = _fb_get("network_health")
        if data:
            return data
    return _network_health


def update_network_health(data: dict):
    _network_health.update(data)
    if USE_FIREBASE:
        _fb_update("network_health", data)
    else:
        _save_json("network_health.json", _network_health)


# ════════════════════════════════════════════════════════════
# AGENT STATS
# ════════════════════════════════════════════════════════════

def get_agent_stats() -> dict:
    if USE_FIREBASE:
        data = _fb_get("agent_stats")
        if data:
            return data
    return _agent_stats


def update_agent_stats(data: dict):
    _agent_stats.update(data)
    if USE_FIREBASE:
        _fb_update("agent_stats", data)
    else:
        _save_json("agent_stats.json", _agent_stats)
