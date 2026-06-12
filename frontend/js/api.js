/* ============================================================
   RAILSENSE AI — api.js
   Backend Integration Layer

   Load order in index.html:
     <script src="js/api.js"></script>   ← FIRST
     <script src="js/main.js"></script>  ← SECOND

   What this file does:
     1. Opens WebSocket to backend → receives live updates
     2. On DOMContentLoaded → loads all existing data from REST API
     3. All fault buttons → call /fault/inject → full AI pipeline
     4. All WS events → patch the dashboard DOM directly
   ============================================================ */

'use strict';

// ─────────────────────────────────────────
//  CONFIG
//  Change to Railway.app URL when deployed
// ─────────────────────────────────────────
const API_BASE = "http://localhost:8000";
const WS_URL   = "ws://localhost:8000/ws";


// ─────────────────────────────────────────
//  FETCH HELPERS
// ─────────────────────────────────────────
async function apiGet(path) {
    try {
        const res = await fetch(API_BASE + path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn(`[API] GET ${path} failed — backend may not be running:`, e.message);
        return null;
    }
}

async function apiPost(path, body) {
    try {
        const res = await fetch(API_BASE + path, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn(`[API] POST ${path} failed:`, e.message);
        return null;
    }
}


// ─────────────────────────────────────────
//  WEBSOCKET — Live pipeline from backend
// ─────────────────────────────────────────
let _ws = null;

function connectWebSocket() {
    _ws = new WebSocket(WS_URL);

    _ws.onopen = () => {
        console.log('%c[RailSense WS] ✓ Connected to backend', 'color:#00ff87;font-weight:bold');
        updateConnectionBadge(true);
    };

    _ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }

        switch (msg.type) {

            /* ── Initial state on first connect ── */
            case "connected":
                if (msg.anomalies?.length)
                    msg.anomalies.forEach(a => prependAlertToFeed(a));
                if (msg.logs?.length)
                    msg.logs.forEach(l => appendAgentLog(l));
                if (msg.stats)
                    populateAgentStats(msg.stats);
                if (msg.network)
                    updateHealthGauges(msg.network);
                break;

            /* ── New anomaly from sensor pipeline ── */
            case "new_anomaly":
                prependAlertToFeed(msg.data);
                animateAgentReaction('agentAnomaly', msg.data.severity);
                incrementAlertCounter();
                break;

            /* ── Bulk train position update (every 2s) ── */
            case "train_update_batch":
                if (msg.trains)       msg.trains.forEach(t => updateTrainOnMap(t));
                if (msg.new_anomalies) msg.new_anomalies.forEach(a => {
                    prependAlertToFeed(a);
                    animateAgentReaction('agentAnomaly', a.severity);
                    incrementAlertCounter();
                });
                if (msg.new_logs)    msg.new_logs.forEach(l => appendAgentLog(l));
                if (msg.stats)       populateAgentStats(msg.stats);
                if (msg.network)     updateHealthGauges(msg.network);
                break;

            /* ── Full fault injection pipeline result ── */
            case "fault_injection":
                if (msg.alert) {
                    prependAlertToFeed(msg.alert);
                    animateAgentReaction('agentAnomaly', msg.alert.severity);
                    incrementAlertCounter();
                }
                if (msg.logs) msg.logs.forEach(l => appendAgentLog(l));
                if (msg.response_actions?.length)
                    showAIResponsePanel(msg.response_actions, msg.fault_type);
                // also run local visual effects
                if (window.injectFault && msg.fault_type !== 'sensor_detected')
                    window.injectFault(msg.fault_type);
                break;

            /* ── Anomaly resolved ── */
            case "alert_resolved":
                markAlertResolved(msg.alert_id);
                break;

            /* ── Single train update ── */
            case "train_update":
                if (msg.data) updateTrainOnMap(msg.data);
                break;

            /* ── Agent stats update ── */
            case "agent_stats":
                populateAgentStats(msg.data);
                break;

            /* ── Network health gauges ── */
            case "network_health":
                updateHealthGauges(msg.data);
                break;

            /* ── Keepalive ── */
            case "heartbeat":
                _ws.send("ping");
                break;
        }
    };

    _ws.onclose = () => {
        updateConnectionBadge(false);
        console.warn('[RailSense WS] Disconnected — reconnecting in 3s...');
        setTimeout(connectWebSocket, 3000);
    };

    _ws.onerror = () => {
        console.warn('[RailSense WS] Cannot reach backend at', WS_URL);
    };
}


// ─────────────────────────────────────────
//  LOAD INITIAL DATA on page load
// ─────────────────────────────────────────
async function loadInitialData() {
    const [anomalies, logs, stats, health] = await Promise.all([
        apiGet("/anomalies?limit=20"),
        apiGet("/agents/log?limit=30"),
        apiGet("/agents/stats"),
        apiGet("/network/health"),
    ]);

    if (anomalies?.length) anomalies.forEach(a => prependAlertToFeed(a));
    if (logs?.length)      logs.forEach(l => appendAgentLog(l));
    if (stats)             populateAgentStats(stats);
    if (health)            updateHealthGauges(health);
}


// ─────────────────────────────────────────
//  FAULT INJECTION — called by patched buttons
//  Sends fault to backend → full AI pipeline → WS broadcast
// ─────────────────────────────────────────
const _FAULT_LOCATIONS = {
    track:     'Pune Division, KM 847',
    signal:    'Delhi-Agra Corridor',
    overspeed: 'Bengaluru Suburban Sector',
    crowd:     'Mumbai CST Platform 4',
    comm:      'Kolkata Sector 7',
    sensor:    'Hyderabad Junction',
};

window.injectFaultAPI = async function(type) {
    console.log(`[RailSense] Injecting fault: ${type}`);

    const result = await apiPost("/fault/inject", {
        fault_type: type,
        location:   _FAULT_LOCATIONS[type] || 'India Rail Network',
        train_id:   "T101",
    });

    if (result) {
        const el = document.getElementById('faultStatusText');
        if (el) {
            el.textContent = `⚡ ${type.toUpperCase()} fault injected — ${result.severity} — AI responded in ${result.response_time_seconds}s`;
            el.style.color  = '#00ff87';
        }
        console.log(`[RailSense] Pipeline: ${result.pipeline_fired?.join(' → ')} | ${result.response_time_seconds}s`);
    }
    return result;
};


// ─────────────────────────────────────────
//  DOM PATCHING HELPERS
//  These write real backend data into the existing dashboard HTML
// ─────────────────────────────────────────

/* Prepend a new alert row to the anomaly feed */
function prependAlertToFeed(alert) {
    const feed = document.getElementById('anomalyFeed') ||
                 document.querySelector('.anomaly-feed') ||
                 document.querySelector('.alert-list');
    if (!feed) return;

    const sevClass = (alert.severity || 'low').toLowerCase();
    const el = document.createElement('div');
    el.className = `alert-item ${sevClass} new-alert`;
    el.setAttribute('data-alert-id', alert.id);
    el.innerHTML = `
        <div class="alert-sev-badge ${sevClass}">${(alert.severity||'LOW').toUpperCase()}</div>
        <div class="alert-body">
            <div class="alert-title">${alert.issue || alert.description || 'Anomaly Detected'}</div>
            <div class="alert-loc"><i class="fas fa-map-marker-alt"></i> ${alert.location || '—'}</div>
            <div class="alert-action">${alert.action || ''}</div>
        </div>
        <div class="alert-meta">
            <span class="alert-time">${_timeAgo(alert.timestamp)}</span>
            <span class="alert-train">${alert.train_id || ''}</span>
        </div>`;
    feed.insertBefore(el, feed.firstChild);
    // Keep feed max 20 items
    while (feed.children.length > 20) feed.removeChild(feed.lastChild);

    // Also push to global STATE if main.js uses it
    if (window.STATE?.alerts) window.STATE.alerts.unshift(alert);
}

/* Mark an alert as resolved in the feed */
function markAlertResolved(alertId) {
    const el = document.querySelector(`[data-alert-id="${alertId}"]`);
    if (el) {
        el.classList.add('resolved');
        el.style.opacity = '0.4';
    }
}

/* Append an agent log entry to the AI Decision Timeline */
function appendAgentLog(log) {
    const timeline = document.getElementById('aiTimeline') ||
                     document.querySelector('.ai-timeline') ||
                     document.querySelector('.decision-log');
    if (timeline) {
        const icon = log.agent === 'MonitorAgent'  ? '👁' :
                     log.agent === 'AnomalyAgent'  ? '🔍' : '🛡';
        const el = document.createElement('div');
        el.className = 'timeline-item';
        el.innerHTML = `
            <div class="tl-icon">${icon}</div>
            <div class="tl-body">
                <span class="tl-agent">${log.agent}</span>
                <span class="tl-msg">${log.message}</span>
            </div>
            <span class="tl-time">${_timeAgo(log.timestamp)}</span>`;
        timeline.insertBefore(el, timeline.firstChild);
        while (timeline.children.length > 30) timeline.removeChild(timeline.lastChild);
    }
    // Also expose for voice messages panel in main.js
    if (window.addVoiceMessage) {
        const icon = log.agent === 'MonitorAgent' ? '👁' :
                     log.agent === 'AnomalyAgent' ? '🔍' : '🛡';
        window.addVoiceMessage(`"${icon} ${log.agent}: ${log.message}"`);
    }
}

/* Update the 6 health gauge values */
function updateHealthGauges(health) {
    const MAP = {track:'rgv0', signal:'rgv1', safety:'rgv2', ops:'rgv3', emergency:'rgv4', ai:'rgv5'};
    for (const [key, id] of Object.entries(MAP)) {
        const el = document.getElementById(id);
        if (el && health[key] !== undefined)
            el.textContent = parseFloat(health[key]).toFixed(1) + '%';
    }
    const si = document.getElementById('safetyIndex');
    if (si && health.safety) si.textContent = parseFloat(health.safety).toFixed(1);
}

/* Populate AI War Room agent stats */
function populateAgentStats(stats) {
    if (!stats) return;
    if (stats.monitor) {
        const m = stats.monitor;
        _set('monitorUptime',    (m.uptime||99.9).toFixed(1)+'%');
        _set('monitorConf',      (m.confidence||98.2).toFixed(1)+'%');
        _set('sensorsWatched',   m.sensors_watched||126);
        _set('eventsPerHour',    (m.events_per_hour||4563).toLocaleString());
    }
    if (stats.anomaly) {
        const a = stats.anomaly;
        const total = (a.critical||0)+(a.high||0)+(a.medium||0)+(a.low||0)||1;
        _set('critCount',   a.critical||0);
        _set('highCount',   a.high||0);
        _set('medCount',    a.medium||0);
        _set('lowCount',    a.low||0);
        _set('anomalyConf', (a.confidence||94.7).toFixed(1)+'%');
        _pct('sevCritical', (a.critical||0)/total*100);
        _pct('sevHigh',     (a.high||0)/total*100);
        _pct('sevMedium',   (a.medium||0)/total*100);
        _pct('sevLow',      (a.low||0)/total*100);
    }
    if (stats.response) {
        const r = stats.response;
        _set('maintDispatches', r.maintenance_dispatches||0);
        _set('driverAdvisories',r.driver_advisories||0);
        _set('emergActions',    r.emergency_actions||0);
        _set('responseConf',    (r.readiness||96.1).toFixed(1)+'%');
    }
}

/* Animate an agent card when it reacts to an event */
function animateAgentReaction(elementId, severity) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const colour = severity === 'CRITICAL' ? '#ff4757' :
                   severity === 'HIGH'     ? '#ff6b35' :
                   severity === 'MEDIUM'   ? '#ffa502' : '#2ed573';
    el.style.boxShadow = `0 0 30px ${colour}88`;
    setTimeout(() => { el.style.boxShadow = ''; }, 2000);
}

/* Increment the anomaly counter badge */
function incrementAlertCounter() {
    const el = document.getElementById('alertCounter') ||
               document.querySelector('.alert-count');
    if (el) el.textContent = parseInt(el.textContent||0) + 1;
}

/* Update train on map */
function updateTrainOnMap(train) {
    if (window.STATIONS && train.location) {
        const match = window.STATIONS.find(s =>
            train.location.toLowerCase().includes(s.id)
        );
        if (match && train.status === 'CRITICAL') match.status = 'critical';
        else if (match && train.status === 'WARNING') match.status = 'warning';
    }
}

/* Show AI Response Panel after fault injection */
function showAIResponsePanel(actions, faultType) {
    const panel = document.getElementById('aiResponsePanel');
    if (panel) panel.style.display = 'block';

    const actionsEl = document.getElementById('arpActions');
    if (!actionsEl) return;
    actionsEl.innerHTML = '';

    actions.forEach((action, i) => {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'arp-action';
            el.innerHTML = `<i class="fas fa-shield-alt"></i><span>${action}</span>`;
            actionsEl.appendChild(el);
        }, i * 300);
    });

    const st = document.getElementById('faultStatusText');
    if (st) {
        st.textContent = `⚡ ${(faultType||'').toUpperCase()} — AI pipeline fired`;
        st.style.color  = '#00ff87';
    }
}

/* Update connection badge */
function updateConnectionBadge(connected) {
    document.querySelectorAll('.status-badge').forEach(b => {
        if (b.textContent.includes('System') || b.textContent.includes('Online')) {
            b.className = `status-badge ${connected ? 'online' : 'offline'}`;
        }
    });
}


// ─────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────
function _timeAgo(iso) {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
}

function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function _pct(id, val) {
    const el = document.getElementById(id);
    if (el) el.style.width = val.toFixed(1) + '%';
}


// ─────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    console.log('%c[RailSense API] Connecting to backend...', 'color:#00c8ff;font-weight:bold');
    connectWebSocket();
    await loadInitialData();
    console.log('%c[RailSense API] ✓ Initialised', 'color:#00ff87;font-weight:bold');
});
