/* ============================================================
   RAILSENSE AI — COMMAND CENTER JAVASCRIPT
   Full interactivity, live simulation, charts, map, AI agents
   ============================================================ */

'use strict';

// ============================================================
// GLOBAL STATE
// ============================================================
const STATE = {
    alerts: [],
    decisionCount: 2516,
    timelineStep: 3,
    faultInjected: false,
    networkHealth: { track: 97.8, signal: 96.2, safety: 98.5, ops: 95.1, emergency: 99.0, ai: 99.7 },
    trains: [],
    anomalyChart: null,
    regionChart: null,
    severityChart: null,
    performanceChart: null,
    passengerChart: null,
    heartbeatData: new Array(50).fill(0),
    waveformData: new Array(100).fill(0),
    radarDots: [],
    mapView: 'twin',
    voiceMessages: [
        '"Track anomaly detected near Pune Division."',
        '"Response team dispatched to sector 7-B."',
        '"Speed advisory issued for Delhi-Agra corridor."',
        '"Signal restored at Mumbai Central."',
        '"Crowd density elevated at Howrah Station."',
        '"AI confidence score updated: 99.7%."',
        '"Network health check complete — all systems nominal."',
        '"Emergency protocol activated — Chennai sector."',
        '"Predictive model updated with new sensor data."',
        '"Maintenance crew en route — ETA 4 minutes."',
    ],
    voiceIdx: 0
};

// Station coordinates on the 800x480 map canvas
const STATIONS = [
    { id: 'delhi',     name: 'Delhi',     x: 0.42, y: 0.19, status: 'critical', zone: 'N' },
    { id: 'mumbai',    name: 'Mumbai',    x: 0.22, y: 0.57, status: 'safe',     zone: 'W' },
    { id: 'pune',      name: 'Pune',      x: 0.26, y: 0.63, status: 'warning',  zone: 'W' },
    { id: 'ahmedabad', name: 'Ahmedabad', x: 0.18, y: 0.46, status: 'safe',     zone: 'W' },
    { id: 'kolkata',   name: 'Kolkata',   x: 0.78, y: 0.43, status: 'safe',     zone: 'E' },
    { id: 'hyderabad', name: 'Hyderabad', x: 0.54, y: 0.65, status: 'warning',  zone: 'S' },
    { id: 'bengaluru', name: 'Bengaluru', x: 0.44, y: 0.77, status: 'safe',     zone: 'S' },
    { id: 'chennai',   name: 'Chennai',   x: 0.58, y: 0.77, status: 'safe',     zone: 'S' },
];

const ROUTES = [
    ['delhi', 'mumbai'],
    ['delhi', 'kolkata'],
    ['delhi', 'hyderabad'],
    ['delhi', 'ahmedabad'],
    ['mumbai', 'pune'],
    ['mumbai', 'ahmedabad'],
    ['mumbai', 'hyderabad'],
    ['pune', 'hyderabad'],
    ['hyderabad', 'chennai'],
    ['hyderabad', 'bengaluru'],
    ['chennai', 'bengaluru'],
    ['kolkata', 'hyderabad'],
    ['kolkata', 'delhi'],
];

const ALERT_DATA = [
    { id: 1, sev: 'critical', title: 'Track Fracture Detected', loc: 'Pune Division, KM 847', time: '0:23 ago', isNew: true },
    { id: 2, sev: 'high',     title: 'Signal Failure',          loc: 'Delhi-Agra Route',      time: '1:45 ago', isNew: false },
    { id: 3, sev: 'medium',   title: 'Platform Overcrowding',   loc: 'Mumbai CST',            time: '3:12 ago', isNew: false },
    { id: 4, sev: 'low',      title: 'Temperature Spike',       loc: 'Hyderabad Sector 4',    time: '5:07 ago', isNew: false },
    { id: 5, sev: 'high',     title: 'Track Geometry Warning',  loc: 'Kolkata Metro Line',    time: '6:30 ago', isNew: false },
    { id: 6, sev: 'medium',   title: 'Power Fluctuation',       loc: 'Chennai Central',       time: '8:55 ago', isNew: false },
    { id: 7, sev: 'critical', title: 'Emergency Brake Event',   loc: 'Bengaluru Suburban',    time: '11:20 ago', isNew: false },
];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initParticles();
    initHeroCounters();
    renderAnomalyFeed();
    initMapCanvas();
    initTrains();
    initHeartbeat();
    initWaveform();
    initRadialGauges();
    initPredictiveGauges();
    initCharts();
    initTimeline();
    initVoiceLoop();
    initDecisionCounter();
    initTicker();
    initFilterButtons();
    startLiveUpdates();
    console.log('%c🚂 RailSense AI — Command Center Loaded ', 'background: linear-gradient(135deg,#020810,#040d1a); color: #00c8ff; padding: 12px 24px; font-size: 14px; font-weight: bold; border: 1px solid #00c8ff;');
});

// ============================================================
// LIVE CLOCK
// ============================================================
function initClock() {
    function tick() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const el = document.getElementById('liveClock');
        if (el) el.textContent = `${hh}:${mm}:${ss}`;

        const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const dateEl = document.getElementById('liveDate');
        if (dateEl) dateEl.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
    tick();
    setInterval(tick, 1000);
}

// ============================================================
// PARTICLE SYSTEM
// ============================================================
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.size = Math.random() * 1.5 + 0.5;
            this.alpha = Math.random() * 0.4 + 0.1;
            this.color = Math.random() > 0.7 ? '#ff7300' : '#00c8ff';
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.alpha;
            ctx.fill();
        }
    }

    for (let i = 0; i < 120; i++) particles.push(new Particle());

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = '#00c8ff';
                    ctx.globalAlpha = (1 - dist / 100) * 0.06;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        drawConnections();
        particles.forEach(p => { p.update(); p.draw(); });
        ctx.globalAlpha = 1;
        requestAnimationFrame(animate);
    }
    animate();
}

// ============================================================
// HERO COUNTERS
// ============================================================
function initHeroCounters() {
    const counters = document.querySelectorAll('.counter');
    counters.forEach(c => {
        const target = parseFloat(c.dataset.target);
        const suffix = c.dataset.suffix || '';
        const isDecimal = target % 1 !== 0;
        let current = 0;
        const duration = 2500;
        const steps = 80;
        const increment = target / steps;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current = Math.min(current + increment, target);
            if (target >= 1000000) {
                c.textContent = (current / 1000000).toFixed(1) + suffix;
            } else if (target >= 1000) {
                c.textContent = Math.floor(current).toLocaleString() + suffix;
            } else if (isDecimal) {
                c.textContent = current.toFixed(1) + suffix;
            } else {
                c.textContent = Math.floor(current) + suffix;
            }
            if (step >= steps) {
                clearInterval(timer);
                if (target >= 1000000) c.textContent = (target / 1000000).toFixed(0) + suffix;
                else if (target >= 1000) c.textContent = target.toLocaleString() + suffix;
                else if (isDecimal) c.textContent = target.toFixed(1) + suffix;
                else c.textContent = target + suffix;
            }
        }, duration / steps);
    });
}

// ============================================================
// ANOMALY FEED RENDERER
// ============================================================
function renderAnomalyFeed(extraAlerts = []) {
    const feed = document.getElementById('anomalyFeed');
    if (!feed) return;

    const allAlerts = [...extraAlerts, ...ALERT_DATA];
    const total = document.getElementById('alertTotal');
    if (total) total.textContent = allAlerts.length + ' Active';

    feed.innerHTML = allAlerts.map(a => `
        <div class="alert-item ${a.sev}" style="animation: fadeInUp 0.4s ease forwards;">
            <div class="alert-sev-dot"></div>
            <div class="alert-body">
                <div class="alert-sev-label">${a.sev.toUpperCase()}</div>
                <div class="alert-title">${a.title}</div>
                <div class="alert-loc"><i class="fas fa-map-marker-alt"></i> ${a.loc}</div>
            </div>
            <div style="text-align:right">
                <div class="alert-time">${a.time}</div>
                ${a.isNew ? '<div class="alert-new">● NEW</div>' : ''}
            </div>
        </div>
    `).join('');
}

// ============================================================
// INDIA MAP CANVAS
// ============================================================
function initMapCanvas() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth || 760;
    canvas.height = 480;

    window.addEventListener('resize', () => {
        canvas.width = container.offsetWidth || 760;
        canvas.height = 480;
    });

    drawMap();
}

function getStationXY(station, cw, ch) {
    return { x: station.x * cw, y: station.y * ch };
}

let trainPositions = [];
function initTrains() {
    ROUTES.forEach((route, i) => {
        trainPositions.push({ route, progress: Math.random(), speed: 0.001 + Math.random() * 0.002, trail: [] });
    });
    animateMap();
}

let mapTime = 0;
function animateMap() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    drawMap();
    mapTime++;
    requestAnimationFrame(animateMap);
}

function drawMap() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // Background glow
    const radGrad = ctx.createRadialGradient(cw * 0.45, ch * 0.5, 0, cw * 0.45, ch * 0.5, cw * 0.5);
    radGrad.addColorStop(0, 'rgba(0,200,255,0.04)');
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, cw, ch);

    // Draw India silhouette (simplified polygon)
    drawIndiaSilhouette(ctx, cw, ch);

    // Draw routes
    if (STATE.mapView !== 'heat') {
        ROUTES.forEach(route => {
            const s1 = STATIONS.find(s => s.id === route[0]);
            const s2 = STATIONS.find(s => s.id === route[1]);
            if (!s1 || !s2) return;
            const p1 = getStationXY(s1, cw, ch);
            const p2 = getStationXY(s2, cw, ch);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = STATE.mapView === 'signal' ? 'rgba(0,255,135,0.4)' : 'rgba(0,200,255,0.3)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }

    // Heat zones
    if (STATE.mapView === 'heat') {
        STATIONS.forEach(s => {
            const p = getStationXY(s, cw, ch);
            const hGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 80);
            if (s.status === 'critical') {
                hGrad.addColorStop(0, 'rgba(255,71,87,0.3)');
                hGrad.addColorStop(0.5, 'rgba(255,71,87,0.1)');
            } else if (s.status === 'warning') {
                hGrad.addColorStop(0, 'rgba(255,165,2,0.25)');
                hGrad.addColorStop(0.5, 'rgba(255,165,2,0.08)');
            } else {
                hGrad.addColorStop(0, 'rgba(0,255,135,0.15)');
                hGrad.addColorStop(0.5, 'rgba(0,255,135,0.05)');
            }
            hGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = hGrad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 80, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Draw trains on routes
    trainPositions.forEach(tp => {
        tp.progress = (tp.progress + tp.speed) % 1;
        const s1 = STATIONS.find(s => s.id === tp.route[0]);
        const s2 = STATIONS.find(s => s.id === tp.route[1]);
        if (!s1 || !s2) return;
        const p1 = getStationXY(s1, cw, ch);
        const p2 = getStationXY(s2, cw, ch);

        const tx = p1.x + (p2.x - p1.x) * tp.progress;
        const ty = p1.y + (p2.y - p1.y) * tp.progress;

        // Trail
        tp.trail.push({ x: tx, y: ty });
        if (tp.trail.length > 20) tp.trail.shift();

        if (tp.trail.length > 1) {
            for (let i = 1; i < tp.trail.length; i++) {
                const alpha = i / tp.trail.length * 0.6;
                ctx.beginPath();
                ctx.moveTo(tp.trail[i - 1].x, tp.trail[i - 1].y);
                ctx.lineTo(tp.trail[i].x, tp.trail[i].y);
                ctx.strokeStyle = `rgba(0,200,255,${alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // Train dot
        const trainColor = STATE.mapView === 'signal' ? '#00ff87' : '#00c8ff';
        ctx.beginPath();
        ctx.arc(tx, ty, 5, 0, Math.PI * 2);
        ctx.fillStyle = trainColor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tx, ty, 8, 0, Math.PI * 2);
        ctx.strokeStyle = trainColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
    });

    // Draw station nodes
    STATIONS.forEach(s => {
        const p = getStationXY(s, cw, ch);
        const pulse = (Math.sin(mapTime * 0.05) + 1) / 2;

        const color = s.status === 'critical' ? '#ff4757'
                    : s.status === 'warning'  ? '#ffa502'
                    : '#00ff87';

        // Outer pulse ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 + pulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = (1 - pulse) * 0.5;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Radar sweep overlay
    const radarX = cw * 0.42, radarY = ch * 0.3;
    const radarR = 60;
    const angle = (mapTime * 0.02) % (Math.PI * 2);
    const sweepGrad = ctx.createConicalGradient ? null : null;
    ctx.beginPath();
    ctx.moveTo(radarX, radarY);
    ctx.arc(radarX, radarY, radarR, angle - 0.8, angle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,200,255,0.06)';
    ctx.fill();

    // Radar rings
    [radarR, radarR * 0.66, radarR * 0.33].forEach(r => {
        ctx.beginPath();
        ctx.arc(radarX, radarY, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,200,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    });
}

function drawIndiaSilhouette(ctx, cw, ch) {
    // Simplified India polygon (relative coords)
    const pts = [
        [0.36, 0.07], [0.44, 0.05], [0.54, 0.08], [0.64, 0.12], [0.70, 0.16],
        [0.78, 0.22], [0.82, 0.30], [0.84, 0.38], [0.82, 0.46], [0.80, 0.52],
        [0.76, 0.56], [0.72, 0.54], [0.68, 0.58], [0.66, 0.64], [0.62, 0.70],
        [0.58, 0.78], [0.54, 0.84], [0.50, 0.92], [0.48, 0.96], [0.46, 0.92],
        [0.42, 0.84], [0.38, 0.78], [0.34, 0.72], [0.30, 0.66], [0.28, 0.60],
        [0.24, 0.54], [0.20, 0.50], [0.16, 0.44], [0.14, 0.38], [0.16, 0.32],
        [0.20, 0.26], [0.24, 0.20], [0.28, 0.16], [0.32, 0.12], [0.36, 0.07],
    ];
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * cw, pts[0][1] * ch);
    pts.slice(1).forEach(p => ctx.lineTo(p[0] * cw, p[1] * ch));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,200,255,0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,200,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// ============================================================
// HEARTBEAT ANIMATION
// ============================================================
function initHeartbeat() {
    const canvas = document.getElementById('heartbeatCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.offsetWidth || 280;
    canvas.height = 40;
    let tick = 0;

    function beatFrame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tick++;
        const w = canvas.width;

        // Generate heartbeat wave
        STATE.heartbeatData.push(generateHeartbeatSample(tick));
        if (STATE.heartbeatData.length > w / 4) STATE.heartbeatData.shift();

        ctx.beginPath();
        const step = w / STATE.heartbeatData.length;
        STATE.heartbeatData.forEach((v, i) => {
            const x = i * step;
            const y = 20 - v * 14;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#00ff87';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#00ff87';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        requestAnimationFrame(beatFrame);
    }
    beatFrame();
}

let hbPhase = 0;
function generateHeartbeatSample(t) {
    hbPhase = (hbPhase + 0.15) % (Math.PI * 2);
    const base = Math.sin(hbPhase) * 0.2;
    const beat = (t % 60 < 5) ? Math.sin((t % 60) * Math.PI / 5) * 1.0 :
                 (t % 60 < 8) ? -Math.sin((t % 60 - 5) * Math.PI / 3) * 0.4 : 0;
    return base + beat;
}

// ============================================================
// WAVEFORM ANIMATION (Voice)
// ============================================================
function initWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.offsetWidth || 400;
    canvas.height = 60;
    let t = 0;

    function waveFrame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const w = canvas.width, h = canvas.height;
        const mid = h / 2;

        ctx.beginPath();
        for (let x = 0; x < w; x++) {
            const freq1 = Math.sin((x * 0.05) + t * 0.1) * 15;
            const freq2 = Math.sin((x * 0.02) + t * 0.07) * 8;
            const freq3 = Math.sin((x * 0.08) + t * 0.15) * 5;
            const y = mid + freq1 + freq2 + freq3;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const waveGrad = ctx.createLinearGradient(0, 0, w, 0);
        waveGrad.addColorStop(0, 'rgba(0,200,255,0.1)');
        waveGrad.addColorStop(0.5, '#00c8ff');
        waveGrad.addColorStop(1, 'rgba(0,200,255,0.1)');
        ctx.strokeStyle = waveGrad;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00c8ff';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        t += 1;
        requestAnimationFrame(waveFrame);
    }
    waveFrame();
}

// ============================================================
// RADIAL HEALTH GAUGES
// ============================================================
function initRadialGauges() {
    const gaugeData = [
        { id: 'rg0', value: 97.8, color: '#00c8ff', label: 'Track Health' },
        { id: 'rg1', value: 96.2, color: '#00c8ff', label: 'Signal Health' },
        { id: 'rg2', value: 98.5, color: '#00ff87', label: 'Safety Score' },
        { id: 'rg3', value: 95.1, color: '#ffa502', label: 'Ops Efficiency' },
        { id: 'rg4', value: 99.0, color: '#00ff87', label: 'Emergency Ready' },
        { id: 'rg5', value: 99.7, color: '#00c8ff', label: 'AI Reliability' },
    ];

    gaugeData.forEach((g, i) => {
        const canvas = document.getElementById(g.id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = 70, cy = 70, r = 55;

        function draw(val) {
            ctx.clearRect(0, 0, 140, 140);
            const startAngle = Math.PI * 0.75;
            const endAngle = Math.PI * 2.25;
            const valueAngle = startAngle + (endAngle - startAngle) * (val / 100);

            // Track
            ctx.beginPath();
            ctx.arc(cx, cy, r, startAngle, endAngle);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Value arc
            const arcGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
            arcGrad.addColorStop(0, 'rgba(0,200,255,0.5)');
            arcGrad.addColorStop(1, g.color);
            ctx.beginPath();
            ctx.arc(cx, cy, r, startAngle, valueAngle);
            ctx.strokeStyle = arcGrad;
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.shadowColor = g.color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Center value
            ctx.fillStyle = g.color;
            ctx.font = 'bold 18px "Roboto Mono"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(val.toFixed(1) + '%', cx, cy);
        }

        // Animate in
        let current = 0;
        const target = g.value;
        const timer = setInterval(() => {
            current = Math.min(current + target / 60, target);
            draw(current);
            if (current >= target) clearInterval(timer);
        }, 30);
    });
}

// ============================================================
// PREDICTIVE GAUGES (Semi-circle)
// ============================================================
function initPredictiveGauges() {
    const configs = [
        { id: 'gauge0', value: 82, color: '#ff4757' },
        { id: 'gauge1', value: 91, color: '#00ff87' },
        { id: 'gauge2', value: 76, color: '#ffa502' },
        { id: 'gauge3', value: 23, color: '#00c8ff' },
        { id: 'gauge4', value: 34, color: '#ff6b81' },
        { id: 'gauge5', value: 97, color: '#00ff87' },
    ];

    configs.forEach(g => {
        const canvas = document.getElementById(g.id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = 50, cy = 55, r = 40;

        function draw(val) {
            ctx.clearRect(0, 0, 100, 60);
            const start = Math.PI, end = Math.PI * 2;
            const vAngle = start + (end - start) * (val / 100);

            ctx.beginPath();
            ctx.arc(cx, cy, r, start, end);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy, r, start, vAngle);
            ctx.strokeStyle = g.color;
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.shadowColor = g.color;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        let cur = 0;
        const timer = setInterval(() => {
            cur = Math.min(cur + g.value / 40, g.value);
            draw(cur);
            if (cur >= g.value) clearInterval(timer);
        }, 30);
    });
}

// ============================================================
// CHART.JS CHARTS
// ============================================================
Chart.defaults.color = 'rgba(255,255,255,0.7)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;

const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000 },
    plugins: {
        legend: {
            display: true,
            labels: { color: 'rgba(255,255,255,0.7)', padding: 12, font: { size: 10 } }
        },
        tooltip: {
            backgroundColor: 'rgba(4,13,26,0.95)',
            borderColor: 'rgba(0,200,255,0.3)',
            borderWidth: 1,
            titleColor: '#00c8ff',
            bodyColor: 'rgba(255,255,255,0.8)',
            padding: 10,
        }
    }
};

const gridStyle = {
    color: 'rgba(255,255,255,0.04)', lineWidth: 1
};
const tickStyle = { color: 'rgba(255,255,255,0.5)' };

function initCharts() {
    // 1. Anomaly Time Chart
    const atCtx = document.getElementById('anomalyTimeChart');
    if (atCtx) {
        const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`);
        STATE.anomalyChart = new Chart(atCtx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [
                    { label: 'Critical', data: genData(24, 0, 3), borderColor: '#ff4757', backgroundColor: 'rgba(255,71,87,0.1)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3 },
                    { label: 'High', data: genData(24, 0, 8), borderColor: '#ff7300', backgroundColor: 'rgba(255,115,0,0.08)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 2 },
                    { label: 'Medium', data: genData(24, 2, 15), borderColor: '#ffa502', backgroundColor: 'rgba(255,165,2,0.06)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 2 },
                ]
            },
            options: {
                ...chartDefaults,
                scales: {
                    y: { grid: gridStyle, ticks: tickStyle, beginAtZero: true },
                    x: { grid: gridStyle, ticks: tickStyle }
                }
            }
        });
    }

    // 2. Region Wise
    const rgCtx = document.getElementById('regionChart');
    if (rgCtx) {
        STATE.regionChart = new Chart(rgCtx, {
            type: 'bar',
            data: {
                labels: ['Delhi', 'Mumbai', 'Kolkata', 'Hyderabad', 'Chennai', 'Bengaluru'],
                datasets: [{
                    label: 'Alerts',
                    data: [12, 8, 5, 9, 4, 6],
                    backgroundColor: ['rgba(255,71,87,0.7)','rgba(255,115,0,0.7)','rgba(0,200,255,0.7)','rgba(255,165,2,0.7)','rgba(0,255,135,0.7)','rgba(0,200,255,0.5)'],
                    borderColor: ['#ff4757','#ff7300','#00c8ff','#ffa502','#00ff87','#00c8ff'],
                    borderWidth: 1, borderRadius: 4,
                }]
            },
            options: {
                ...chartDefaults,
                plugins: { ...chartDefaults.plugins, legend: { display: false } },
                scales: {
                    y: { grid: gridStyle, ticks: tickStyle, beginAtZero: true },
                    x: { grid: { display: false }, ticks: tickStyle }
                }
            }
        });
    }

    // 3. Severity Donut
    const sevCtx = document.getElementById('severityChart');
    if (sevCtx) {
        STATE.severityChart = new Chart(sevCtx, {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    data: [12, 28, 42, 18],
                    backgroundColor: ['rgba(255,71,87,0.8)','rgba(255,115,0,0.8)','rgba(255,165,2,0.8)','rgba(0,255,135,0.8)'],
                    borderColor: ['#ff4757','#ff7300','#ffa502','#00ff87'],
                    borderWidth: 2, hoverOffset: 10
                }]
            },
            options: {
                ...chartDefaults,
                cutout: '60%',
                plugins: {
                    ...chartDefaults.plugins,
                    legend: { position: 'right', labels: { color: 'rgba(255,255,255,0.7)', padding: 10, font: { size: 10 } } }
                }
            }
        });
    }

    // 4. Performance Radar
    const perfCtx = document.getElementById('performanceChart');
    if (perfCtx) {
        STATE.performanceChart = new Chart(perfCtx, {
            type: 'radar',
            data: {
                labels: ['Speed', 'Safety', 'Signal', 'Track', 'AI Response', 'Punctuality'],
                datasets: [
                    { label: 'Current', data: [92, 98, 95, 97, 99, 94], backgroundColor: 'rgba(0,200,255,0.15)', borderColor: '#00c8ff', borderWidth: 2, pointBackgroundColor: '#00c8ff', pointRadius: 4 },
                    { label: 'Target', data: [95, 99, 97, 98, 99, 97], backgroundColor: 'rgba(0,255,135,0.08)', borderColor: 'rgba(0,255,135,0.5)', borderWidth: 1.5, pointBackgroundColor: '#00ff87', pointRadius: 3, borderDash: [4, 4] },
                ]
            },
            options: {
                ...chartDefaults,
                scales: {
                    r: {
                        beginAtZero: false, min: 80, max: 100,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        angleLines: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.4)', backdropColor: 'transparent', stepSize: 5 },
                        pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 10 } }
                    }
                }
            }
        });
    }

    // 5. Passenger Density
    const pasCtx = document.getElementById('passengerChart');
    if (pasCtx) {
        const stations = ['Delhi', 'Mumbai', 'Kolkata', 'Hyderabad', 'Chennai', 'Bengaluru', 'Pune', 'Ahmedabad'];
        STATE.passengerChart = new Chart(pasCtx, {
            type: 'bar',
            data: {
                labels: stations,
                datasets: [
                    {
                        label: 'Current Load (%)',
                        data: [78, 92, 65, 71, 58, 84, 89, 62],
                        backgroundColor: (ctx2) => {
                            const val = ctx2.raw;
                            if (val >= 85) return 'rgba(255,71,87,0.7)';
                            if (val >= 70) return 'rgba(255,165,2,0.7)';
                            return 'rgba(0,200,255,0.7)';
                        },
                        borderColor: 'rgba(0,200,255,0.5)',
                        borderWidth: 1, borderRadius: 4,
                    },
                    {
                        label: 'Capacity',
                        data: new Array(8).fill(100),
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1, borderRadius: 4,
                    }
                ]
            },
            options: {
                ...chartDefaults,
                scales: {
                    y: { grid: gridStyle, ticks: { ...tickStyle, callback: v => v + '%' }, max: 120 },
                    x: { grid: { display: false }, ticks: tickStyle }
                }
            }
        });
    }
}

function genData(n, min, max) {
    return Array.from({ length: n }, () => Math.floor(Math.random() * (max - min + 1)) + min);
}

// ============================================================
// FAULT INJECTION ENGINE
// ============================================================
const FAULT_CONFIGS = {
    track: {
        title: '🔴 CRITICAL — Track Failure Injected',
        sev: 'critical',
        alertTitle: 'Track Fracture CRITICAL EVENT',
        alertLoc: 'Injection Point — AI Lab Demo',
        actions: [
            { icon: 'fa-stop-circle', text: 'EMERGENCY STOP issued for 3 trains' },
            { icon: 'fa-hard-hat', text: 'Maintenance crew dispatched — ETA 6 min' },
            { icon: 'fa-broadcast-tower', text: 'Speed advisory broadcast to sector' },
            { icon: 'fa-route', text: 'Alternate route calculated & activated' },
        ],
        cityAffected: 'pune',
    },
    signal: {
        title: '🟠 HIGH — Signal Failure Injected',
        sev: 'high',
        alertTitle: 'Signal System Dropout',
        alertLoc: 'Demo Injection — Delhi Route',
        actions: [
            { icon: 'fa-traffic-light', text: 'Manual signal override activated' },
            { icon: 'fa-tools', text: 'Signal tech team alerted' },
            { icon: 'fa-tachometer-alt', text: 'Speed restriction imposed: 30 kmph' },
        ],
        cityAffected: 'delhi',
    },
    overspeed: {
        title: '🟠 HIGH — Overspeed Event Injected',
        sev: 'high',
        alertTitle: 'Train Overspeed Detected — 142kmph',
        alertLoc: 'Demo Injection — Bengaluru Sector',
        actions: [
            { icon: 'fa-tachometer-alt', text: 'Automatic brake command sent to train' },
            { icon: 'fa-broadcast-tower', text: 'Driver advisory: Reduce speed immediately' },
            { icon: 'fa-chart-bar', text: 'Speed log flagged for review' },
        ],
        cityAffected: 'bengaluru',
    },
    crowd: {
        title: '🟡 MEDIUM — Crowd Surge Injected',
        sev: 'medium',
        alertTitle: 'Platform Crowd Surge Detected',
        alertLoc: 'Demo Injection — Mumbai CST',
        actions: [
            { icon: 'fa-users', text: 'Crowd control team mobilized' },
            { icon: 'fa-train', text: 'Additional train frequency +2 services' },
            { icon: 'fa-volume-up', text: 'PA announcement activated' },
        ],
        cityAffected: 'mumbai',
    },
    comm: {
        title: '🟡 MEDIUM — Communication Failure Injected',
        sev: 'medium',
        alertTitle: 'Radio Blackout Detected',
        alertLoc: 'Demo Injection — Kolkata Sector',
        actions: [
            { icon: 'fa-satellite-dish', text: 'Backup comm channel activated' },
            { icon: 'fa-shield-alt', text: 'Last known position logged' },
            { icon: 'fa-tools', text: 'Telecom team dispatched' },
        ],
        cityAffected: 'kolkata',
    },
    sensor: {
        title: '🔵 LOW — Sensor Malfunction Injected',
        sev: 'low',
        alertTitle: 'IoT Sensor #A-847 Offline',
        alertLoc: 'Demo Injection — Hyderabad Junction',
        actions: [
            { icon: 'fa-microchip', text: 'Redundant sensor activated' },
            { icon: 'fa-tools', text: 'IoT tech scheduled for inspection' },
            { icon: 'fa-chart-line', text: 'Data gap interpolated by AI' },
        ],
        cityAffected: 'hyderabad',
    }
};

window.injectFault = function(type) {
    const cfg = FAULT_CONFIGS[type];
    if (!cfg) return;

    STATE.faultInjected = true;

    // Update fault status
    const statusText = document.getElementById('faultStatusText');
    if (statusText) {
        statusText.textContent = `⚡ INJECTING: ${cfg.title}`;
        statusText.style.color = type === 'track' ? '#ff4757' : type === 'sensor' ? '#00c8ff' : '#ff7300';
    }

    // Add to anomaly feed
    const newAlert = {
        id: Date.now(), sev: cfg.sev,
        title: cfg.alertTitle,
        loc: cfg.alertLoc,
        time: 'Just now',
        isNew: true
    };
    renderAnomalyFeed([newAlert]);

    // Show AI response panel
    const panel = document.getElementById('aiResponsePanel');
    if (panel) {
        panel.style.display = 'block';
        const actionsEl = document.getElementById('arpActions');
        if (actionsEl) {
            actionsEl.innerHTML = '';
            cfg.actions.forEach((action, i) => {
                setTimeout(() => {
                    const el = document.createElement('div');
                    el.className = 'arp-action';
                    el.style.animationDelay = `${i * 0.2}s`;
                    el.innerHTML = `<i class="fas ${action.icon}"></i><span>${action.text}</span>`;
                    actionsEl.appendChild(el);
                }, i * 300);
            });
        }
    }

    // Update city on map
    const city = STATIONS.find(s => s.id === cfg.cityAffected);
    if (city) {
        const prevStatus = city.status;
        city.status = cfg.sev === 'critical' ? 'critical' : cfg.sev === 'high' ? 'warning' : city.status;
        const dot = document.getElementById(`dot-${cfg.cityAffected}`);
        if (dot) {
            dot.className = `city-dot ${city.status}`;
        }
        setTimeout(() => {
            city.status = prevStatus;
            if (dot) dot.className = `city-dot ${prevStatus}`;
        }, 15000);
    }

    // Animate anomaly agent
    animateAgentReaction('agentAnomaly', cfg.sev);

    // Update response agent
    const maintEl = document.getElementById('maintDispatches');
    if (maintEl) maintEl.textContent = parseInt(maintEl.textContent) + 1;

    // Update decision count
    STATE.decisionCount += Math.floor(Math.random() * 5) + 2;
    updateDecisionCount();

    // Advance timeline
    advanceTimeline();

    // Add voice message
    addVoiceMessage(`"${cfg.alertTitle} — AI response initiated."`);

    // Button feedback
    const btn = document.querySelector(`[data-fault="${type}"]`);
    if (btn) {
        btn.style.transform = 'scale(0.95)';
        btn.style.boxShadow = `0 0 30px var(--${cfg.sev === 'critical' ? 'red' : cfg.sev === 'high' ? 'orange' : 'amber'})`;
        setTimeout(() => {
            btn.style.transform = '';
            btn.style.boxShadow = '';
        }, 600);
    }
};

function animateAgentReaction(agentId, severity) {
    const agent = document.getElementById(agentId);
    if (!agent) return;
    const colors = { critical: '#ff4757', high: '#ff7300', medium: '#ffa502', low: '#00c8ff' };
    const c = colors[severity] || '#00c8ff';
    agent.style.borderColor = c;
    agent.style.boxShadow = `0 0 30px ${c}40`;
    setTimeout(() => {
        agent.style.borderColor = '';
        agent.style.boxShadow = '';
    }, 3000);
}

// ============================================================
// DECISION TIMELINE
// ============================================================
function initTimeline() {
    // Auto-advance timeline every 8 seconds
    setInterval(() => {
        advanceTimeline(true);
    }, 8000);
}

function advanceTimeline(auto = false) {
    const items = document.querySelectorAll('.tl-item');
    const active = document.querySelector('.tl-item.active');
    if (!active) return;

    const activeIdx = Array.from(items).indexOf(active);
    active.classList.remove('active');
    active.classList.add('completed');
    active.querySelector('.tl-line') && (active.querySelector('.tl-line').style.background = 'var(--green)');

    const nextIdx = (activeIdx + 1) % items.length;
    if (nextIdx === 0) {
        // Reset all to pending except first
        items.forEach((item, i) => {
            item.classList.remove('completed', 'active', 'pending');
            item.classList.add(i === 0 ? 'completed' : 'pending');
        });
        items[1].classList.remove('pending');
        items[1].classList.add('active');
    } else {
        items[nextIdx].classList.remove('pending');
        items[nextIdx].classList.add('active');
    }
}

// ============================================================
// DECISION COUNTER
// ============================================================
function initDecisionCounter() {
    updateDecisionCount();
    setInterval(() => {
        STATE.decisionCount += Math.floor(Math.random() * 3) + 1;
        updateDecisionCount();
        // Update breakdown
        const dc = document.getElementById('dcRoutine');
        if (dc) dc.textContent = (parseInt(dc.textContent.replace(',', '')) + Math.floor(Math.random() * 2) + 1).toLocaleString();
    }, 3000);
}

function updateDecisionCount() {
    const el = document.getElementById('decisionCount');
    if (el) el.textContent = STATE.decisionCount.toLocaleString();
}

// ============================================================
// TICKER DUPLICATION (for infinite scroll)
// ============================================================
function initTicker() {
    const ticker = document.getElementById('tickerContent');
    if (!ticker) return;
    // Duplicate content for seamless loop
    ticker.innerHTML = ticker.innerHTML + ticker.innerHTML;
}

// ============================================================
// FILTER BUTTONS
// ============================================================
function initFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.section-header-row, .time-filter').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    document.querySelectorAll('.map-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            STATE.mapView = btn.dataset.view;
        });
    });
}

// ============================================================
// VOICE LOOP
// ============================================================
function initVoiceLoop() {
    setInterval(() => {
        addVoiceMessage(STATE.voiceMessages[STATE.voiceIdx % STATE.voiceMessages.length]);
        STATE.voiceIdx++;
    }, 5000);
}

function addVoiceMessage(text) {
    const container = document.getElementById('voiceMessages');
    if (!container) return;

    const now = new Date();
    const time = `${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const el = document.createElement('div');
    el.className = 'vm active';
    el.innerHTML = `<span class="vm-time">${time}</span><span class="vm-text">${text}</span>`;

    container.querySelectorAll('.vm.active').forEach(v => v.classList.remove('active'));
    container.insertBefore(el, container.firstChild);

    if (container.children.length > 6) container.removeChild(container.lastChild);
}

window.processVoiceCommand = function() {
    const input = document.getElementById('voiceInput');
    if (!input || !input.value.trim()) return;
    const cmd = input.value.trim();
    input.value = '';
    addVoiceMessage(`"${cmd}"`);

    // Simple command responses
    const lower = cmd.toLowerCase();
    let response = '"Command received. Processing..."';
    if (lower.includes('status')) response = '"All systems nominal. 128 trains active. 15 alerts."';
    else if (lower.includes('health')) response = '"Network health: 97.3%. All critical systems operational."';
    else if (lower.includes('alert')) response = '"15 active alerts. 2 critical, 4 high priority."';
    else if (lower.includes('train')) response = '"128 trains active. 0 delays above threshold."';
    else if (lower.includes('emergency')) response = '"⚠ Emergency protocol initiated. Notifying ops team."';

    setTimeout(() => addVoiceMessage(response), 1000);
};

// ============================================================
// LIVE UPDATES ENGINE
// ============================================================
function startLiveUpdates() {
    // Update agent stats
    setInterval(() => {
        const evEl = document.getElementById('eventsProcessed');
        if (evEl) {
            const val = parseInt(evEl.textContent.replace(',', ''));
            evEl.textContent = (val + Math.floor(Math.random() * 5) + 1).toLocaleString();
        }
        const sensorEl = document.getElementById('sensorCount');
        if (sensorEl) {
            const base = 126;
            sensorEl.textContent = base + Math.floor(Math.random() * 3 - 1);
        }
        const confEl = document.getElementById('monitorConf');
        if (confEl) {
            const base = 98 + Math.random() * 1.5;
            confEl.textContent = base.toFixed(1) + '%';
        }
    }, 2000);

    // Update map stats
    setInterval(() => {
        const trainsEl = document.getElementById('mapTrains');
        if (trainsEl) {
            trainsEl.textContent = 125 + Math.floor(Math.random() * 6);
        }
        const lastSync = document.getElementById('lastSync');
        if (lastSync) lastSync.textContent = (Math.random() * 0.5 + 0.1).toFixed(1) + 's ago';
    }, 1500);

    // Flicker alert times
    setInterval(() => {
        document.querySelectorAll('.alert-item.critical').forEach(el => {
            el.style.boxShadow = `0 0 20px rgba(255,71,87,0.4)`;
            setTimeout(() => el.style.boxShadow = '', 500);
        });
    }, 2000);

    // Update severity bars randomly
    setInterval(() => {
        const sev = document.getElementById('sevCritical');
        if (sev) {
            const v = 10 + Math.floor(Math.random() * 20);
            sev.style.width = v + '%';
            const cc = document.getElementById('critCount');
            if (cc) cc.textContent = Math.floor(v / 7);
        }
    }, 4000);

    // Update predictive values
    setInterval(() => {
        [
            { id: 'pred0', el: 'pred0', min: 78, max: 88 },
            { id: 'pred2', el: 'pred2', min: 70, max: 82 },
        ].forEach(p => {
            const el = document.getElementById(p.el);
            if (el) {
                const v = p.min + Math.random() * (p.max - p.min);
                el.textContent = v.toFixed(0) + '%';
            }
        });
    }, 6000);

    // Live chart updates
    setInterval(() => {
        if (STATE.anomalyChart) {
            const ds = STATE.anomalyChart.data.datasets;
            ds.forEach(d => {
                d.data.shift();
                d.data.push(Math.floor(Math.random() * (d.label === 'Critical' ? 4 : d.label === 'High' ? 9 : 16)));
            });
            STATE.anomalyChart.update('none');
        }
        if (STATE.passengerChart) {
            const ds = STATE.passengerChart.data.datasets[0];
            ds.data = ds.data.map(v => Math.max(30, Math.min(99, v + Math.floor(Math.random() * 6) - 3)));
            STATE.passengerChart.update('none');
        }
    }, 3000);

    // Update footer stats
    setInterval(() => {
        const el = document.getElementById('ftTrains');
        if (el) el.textContent = 124 + Math.floor(Math.random() * 8);
        const el2 = document.getElementById('ftAlerts');
        if (el2) el2.textContent = 13 + Math.floor(Math.random() * 5);
    }, 5000);

    // Advance timeline automatically
    setInterval(advanceTimeline, 8000);
}

// ============================================================
// EMERGENCY BUTTON
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const emergBtn = document.getElementById('emergencyBtn');
    if (emergBtn) {
        emergBtn.addEventListener('click', () => {
            emergBtn.textContent = '⚠ EMERGENCY ACTIVE';
            emergBtn.style.background = 'linear-gradient(135deg,#ff0000,#cc0000)';
            emergBtn.style.animation = 'none';

            // Flash the screen
            const flash = document.createElement('div');
            flash.style.cssText = `position:fixed;inset:0;background:rgba(255,0,0,0.1);z-index:99999;pointer-events:none;animation:fadeIn 0.1s ease;`;
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 500);

            addVoiceMessage('"⚠ EMERGENCY PROTOCOL ACTIVATED — All units respond immediately."');

            setTimeout(() => {
                emergBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> EMERGENCY';
                emergBtn.style.background = '';
                emergBtn.style.animation = 'emergencyPulse 3s infinite';
            }, 5000);
        });
    }
});

// ============================================================
// INTERSECTION OBSERVER (animations on scroll)
// ============================================================
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.glass-card, .health-gauge-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        revealObserver.observe(el);
    });
});
