"""
Sensor Simulator
────────────────
Generates realistic sensor data for 3 trains moving across India.
Called by the background loop in main.py every 2 seconds.
inject_fault() queues an extreme reading for the demo button.
"""

import random
from datetime import datetime

# 3 trains with real Indian routes
TRAINS = [
    {
        "id":    "T101",
        "name":  "Rajdhani Express",
        "route": [
            ("Delhi",      28.6139, 77.2090),
            ("Agra",       27.1767, 78.0081),
            ("Jhansi",     25.4484, 78.5685),
            ("Bhopal",     23.2599, 77.4126),
            ("Nagpur",     21.1458, 79.0882),
        ],
        "zone": "N"
    },
    {
        "id":    "T102",
        "name":  "Shatabdi Express",
        "route": [
            ("Mumbai",     18.9402, 72.8356),
            ("Pune",       18.5204, 73.8567),
            ("Solapur",    17.6868, 75.9060),
            ("Gulbarga",   17.3297, 76.8343),
            ("Bengaluru",  12.9716, 77.5946),
        ],
        "zone": "W"
    },
    {
        "id":    "T103",
        "name":  "Duronto Express",
        "route": [
            ("Kolkata",    22.5726, 88.3639),
            ("Bhubaneswar",20.2961, 85.8245),
            ("Vizag",      17.6868, 83.2185),
            ("Vijayawada", 16.5062, 80.6480),
            ("Chennai",    13.0827, 80.2707),
        ],
        "zone": "E"
    },
]

# Internal state — tracks position and pending fault
_state = {
    t["id"]: {
        "route_idx": 0,
        "progress":  random.uniform(0, 0.8),
        "pending_fault": None,
    }
    for t in TRAINS
}


def inject_fault(train_id: str, fault_type: str):
    """Queue a fault for the NEXT reading of this train."""
    if train_id in _state:
        _state[train_id]["pending_fault"] = fault_type
        print(f"[Simulator] Fault '{fault_type}' queued for {train_id}")


def _move(train_id: str):
    """Advance train along its route, return (station_label, lat, lng)."""
    train = next(t for t in TRAINS if t["id"] == train_id)
    s     = _state[train_id]
    route = train["route"]

    s["progress"] += random.uniform(0.02, 0.05)
    if s["progress"] >= 1.0:
        s["progress"]  = 0.0
        s["route_idx"] = (s["route_idx"] + 1) % (len(route) - 1)

    i           = s["route_idx"]
    n1, la1, ln1 = route[i]
    n2, la2, ln2 = route[(i + 1) % len(route)]
    p           = s["progress"]
    lat         = la1 + (la2 - la1) * p
    lng         = ln1 + (ln2 - ln1) * p
    label       = f"{n1} → {n2}"
    return label, round(lat, 4), round(lng, 4)


def generate_reading(train_id: str) -> dict:
    """Generate one realistic sensor reading for a train."""
    train  = next(t for t in TRAINS if t["id"] == train_id)
    label, lat, lng = _move(train_id)
    fault  = _state[train_id]["pending_fault"]

    # Normal baseline
    temp      = random.randint(30, 55)
    vibration = random.randint(10, 60)
    signal    = random.choices(["GREEN","GREEN","GREEN","YELLOW","RED"], weights=[70,10,5,10,5])[0]
    speed     = random.randint(60, 120)
    crowding  = random.randint(20, 70)
    status    = "NORMAL"

    # Fault overrides
    if fault == "track":
        temp      = random.randint(76, 88)
        vibration = random.randint(88, 99)
        status    = "CRITICAL"
        _state[train_id]["pending_fault"] = None

    elif fault == "signal":
        signal = "FAULT"
        status = "CRITICAL"
        _state[train_id]["pending_fault"] = None

    elif fault == "overspeed":
        speed  = random.randint(152, 170)
        status = "CRITICAL"
        _state[train_id]["pending_fault"] = None

    elif fault == "crowd":
        crowding = random.randint(92, 100)
        status   = "WARNING"
        _state[train_id]["pending_fault"] = None

    # Auto-set status from values
    if status == "NORMAL":
        if temp > 70 or vibration > 85 or signal == "FAULT":
            status = "CRITICAL"
        elif temp > 60 or vibration > 70 or speed > 140:
            status = "WARNING"

    return {
        "train_id":    train_id,
        "name":        train["name"],
        "zone":        train["zone"],
        "location":    label,
        "lat":         lat,
        "lng":         lng,
        "temperature": temp,
        "vibration":   vibration,
        "signal":      signal,
        "speed":       speed,
        "crowding":    crowding,
        "status":      status,
        "timestamp":   datetime.utcnow().isoformat(),
    }


def generate_all() -> list[dict]:
    """Generate readings for all 3 trains."""
    return [generate_reading(t["id"]) for t in TRAINS]
