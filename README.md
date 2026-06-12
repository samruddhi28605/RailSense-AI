# 🚆 RailSense AI — Integrated System
**FAR AWAY International Hackathon 2026**

---

## ⚡ Quick Start (2 terminals)

### Terminal 1 — Backend
```bash
cd backend
pip install -r requirements.txt
# Open .env and paste your Anthropic API key
python main.py
```
Server starts at → **http://localhost:8000**

### Terminal 2 — Frontend
```bash
# Just open the HTML file — no build step needed
# Option A: VS Code Live Server (install extension, right-click index.html → Open with Live Server)
# Option B: Python simple server
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

---

## ✅ Verify Everything Works

| Check | URL |
|-------|-----|
| Backend alive | http://localhost:8000/health |
| API docs (show judges this) | http://localhost:8000/docs |
| Trains flowing | http://localhost:8000/trains |
| Anomalies | http://localhost:8000/anomalies |
| Agent logs | http://localhost:8000/agents/log |

---

## 🎬 Demo Flow (exactly per PDF script)

1. Open dashboard → trains visible, system online badge green
2. Select **Track Fault** button → click **Inject Fault**
3. Watch: anomaly feed shows **CRITICAL** alert within 5 seconds
4. Watch: AI Decision Timeline shows all 3 agents firing
5. AI Response Panel shows: driver advisory + maintenance dispatch
6. Stat shows response time in seconds vs "8-15 min human"

---

## 🗂 Folder Structure

```
railsense-integrated/
├── backend/
│   ├── main.py                ← FastAPI server + sensor loop (YOUR FILE)
│   ├── database.py            ← JSON storage (YOUR FILE)
│   ├── requirements.txt
│   ├── .env                   ← Add ANTHROPIC_API_KEY here
│   ├── agents/
│   │   ├── monitor_agent.py   ← Threshold checks
│   │   ├── anomaly_agent.py   ← Claude AI classification
│   │   └── response_agent.py  ← Auto-alerts
│   └── simulator/
│       └── sensor_simulator.py ← Fake IoT data for 3 trains
├── frontend/
│   ├── index.html             ← Dashboard (open in browser)
│   ├── css/style.css
│   └── js/
│       ├── api.js             ← Backend connector (YOUR FILE)
│       └── main.js            ← Dashboard visuals
└── data/                      ← JSON files auto-created by backend
```

---

## 🔌 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/health` | Server alive check |
| GET | `/trains` | Live train positions |
| GET | `/anomalies` | Alert history |
| GET | `/agents/log` | Agent activity timeline |
| GET | `/agents/stats` | AI War Room stats |
| GET | `/network/health` | 6 health gauges |
| POST | `/fault/inject` | 🔴 Demo fault injection |
| POST | `/sensor/data` | Raw sensor input |
| WS | `/ws` | Live WebSocket stream |
| GET | `/docs` | Swagger UI |

---

## 🔑 .env Setup

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=8000
```
Get free API key: **console.anthropic.com**

Without API key — system uses rule-based logic (still works for demo).
