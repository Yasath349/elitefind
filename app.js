/* =========================================================
   ELITE FIND — APP LOGIC
   ========================================================= */
'use strict';

/* ---------- Small utilities ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function makeSessionId() {
  // Human-friendly, low-ambiguity alphabet (no 0/O/1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Compass bearing (0-360°, 0 = north) from point A to point B — used to point
// the direction arrow straight at the other person, independent of roads.
function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function fmtDistance(m) {
  if (m == null || isNaN(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function fmtETA(m, walkingSpeedMps = 1.35) {
  if (m == null || isNaN(m)) return '—';
  const secs = m / walkingSpeedMps;
  const mins = Math.round(secs / 60);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

/* =========================================================
   TOASTS
   ========================================================= */
const Toast = {
  stack: null,
  init() { this.stack = $('#toastStack'); },
  icons: {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/></svg>',
  },
  show(type, title, msg, ttl = 4200) {
    if (!this.stack) return;
    const el = document.createElement('div');
    el.className = `toast glass ${type}`;
    el.innerHTML = `<div class="toast-ico">${this.icons[type] || this.icons.info}</div>
      <div><b>${title}</b>${msg ? `<span>${msg}</span>` : ''}</div>`;
    this.stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 320);
    }, ttl);
  },
};

/* =========================================================
   MODAL
   ========================================================= */
const Modal = {
  el: null, init() { this.el = $('#modalOverlay'); },
  show({ icon = 'success', title, body, actionLabel = 'Nice', onAction } = {}) {
    if (!this.el) return;
    $('#modalIcon').className = `modal-ico ${icon}`;
    $('#modalTitle').textContent = title || '';
    $('#modalBody').textContent = body || '';
    const btn = $('#modalAction');
    btn.textContent = actionLabel;
    btn.onclick = () => { this.hide(); onAction && onAction(); };
    this.el.classList.add('active');
  },
  hide() { this.el && this.el.classList.remove('active'); },
};

/* =========================================================
   THEME
   ========================================================= */
const ThemeManager = {
  key: 'elitefind_theme',
  init() {
    const saved = localStorage.getItem(this.key);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.set(saved || (prefersDark ? 'dark' : 'light'));
    $$('.theme-toggle').forEach((btn) =>
      btn.addEventListener('click', () => {
        btn.classList.add('spin');
        setTimeout(() => btn.classList.remove('spin'), 500);
        this.set(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
      })
    );
  },
  set(mode) {
    document.documentElement.dataset.theme = mode;
    localStorage.setItem(this.key, mode);
  },
};

/* =========================================================
   ROUTER (SPA views)
   ========================================================= */
const Router = {
  init() {
    $$('.nav-link[data-view]').forEach((link) =>
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.go(link.dataset.view);
        $('#navLinks').classList.remove('open');
      })
    );
    $$('[data-goto]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.go(el.dataset.goto);
      })
    );
    $$('[data-scroll]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.go('home', false);
        $$('.nav-link[data-view]').forEach((l) => l.classList.remove('active'));
        requestAnimationFrame(() => {
          $(`#${el.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        $('#navLinks').classList.remove('open');
      })
    );
    window.addEventListener('hashchange', () => this.go(location.hash.replace('#', '') || 'home', false));
    this.go(location.hash.replace('#', '') || 'home', false);
  },
  go(name, push = true) {
    const view = $(`#view-${name}`);
    if (!view) return;
    // Safety net: the full-screen tracking map only ever makes sense on the
    // Track view — drop it on any other navigation so the navbar can never
    // end up permanently hidden.
    if (name !== 'track') document.body.classList.remove('map-immersive');
    $$('.view').forEach((v) => v.classList.remove('active'));
    view.classList.add('active');
    $$('.nav-link[data-view]').forEach((l) => l.classList.toggle('active', l.dataset.view === name));
    if (push) history.pushState(null, '', `#${name}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'track') TrackController.onEnterView();
    if (name === 'share') ShareController.onEnterView();
  },
};

/* =========================================================
   AUDIO (soft UI sounds via Web Audio API, synthesized — no asset files needed)
   ========================================================= */
const Audio_ = {
  ctx: null,
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(freq, duration = 0.14, type = 'sine', gainPeak = 0.06, delay = 0) {
    try {
      const ctx = this.ensure();
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + duration + 0.02);
    } catch (e) { /* audio unsupported — fail silently */ }
  },
  click() { this.tone(660, 0.06, 'sine', 0.05); },
  success() { this.tone(523.25, 0.12, 'sine', 0.06); this.tone(783.99, 0.16, 'sine', 0.06, 0.09); },
  error() { this.tone(220, 0.18, 'sawtooth', 0.045); },
  notify() { this.tone(880, 0.1, 'triangle', 0.05); },
  arrival() {
    [880, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.07, i * 0.12));
  },
  // Repeating proximity beep — used on both the Share and Track screens once
  // the two devices are within 5m of each other. Keeps beeping until
  // stopAlarm() is called (on disconnect, stop-sharing, or moving apart).
  _alarmTimer: null,
  startAlarm() {
    if (this._alarmTimer) return; // already beeping — don't stack intervals
    this.arrival();
    this._alarmTimer = setInterval(() => this.arrival(), 1800);
  },
  stopAlarm() {
    if (this._alarmTimer) {
      clearInterval(this._alarmTimer);
      this._alarmTimer = null;
    }
  },
};

/* Mobile browsers (iOS Safari especially) refuse to start/resume an AudioContext
   until it happens inside a real user gesture. Unlock it on the very first touch
   anywhere in the app so the later, automatic 5m-proximity beep is never silently
   swallowed. */
window.addEventListener('touchstart', () => Audio_.ensure(), { once: true, passive: true });
window.addEventListener('pointerdown', () => Audio_.ensure(), { once: true });

/* Ripple + click sound on all .btn */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn, .icon-btn');
  if (!btn) return;
  Audio_.click();
  const rect = btn.getBoundingClientRect();
  const r = document.createElement('span');
  r.className = 'ripple';
  const size = Math.max(rect.width, rect.height) * 1.4;
  r.style.width = r.style.height = `${size}px`;
  r.style.left = `${e.clientX - rect.left - size / 2}px`;
  r.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.style.position = btn.style.position || 'relative';
  btn.appendChild(r);
  setTimeout(() => r.remove(), 650);
});

/* =========================================================
   SYNC LAYER
   Uses Firebase Realtime Database when configured; otherwise falls
   back to a fully-functional LOCAL DEMO MODE (BroadcastChannel +
   localStorage) that simulates a second device in the same browser.
   Both expose the same interface so the rest of the app never cares
   which transport is active.
   ========================================================= */
const SyncLayer = (function () {
  // 'firebase' = user configured their own backend (private, best for production).
  // 'ntfy'     = default. A free, keyless public pub/sub relay (ntfy.sh) that
  //              actually works between two *real* devices with zero setup —
  //              this is what fixes "session not found" when tracking a real person.
  // The local BroadcastChannel/localStorage channel is ALSO always wired up
  // underneath, purely as a same-browser/offline-dev convenience — it is never
  // the only transport, so two tabs on one laptop and two phones in the real
  // world both work the same way.
  let mode = 'ntfy';
  let db = null;
  const channel = ('BroadcastChannel' in window) ? new BroadcastChannel('elitefind_demo') : null;
  const listeners = new Map(); // sessionId -> Set<callback>
  const NTFY_BASE = 'https://ntfy.sh';
  const topicFor = (sessionId) => `elitefind-app-${sessionId}`;

  function initFirebase() {
    if (!window.FIREBASE_IS_CONFIGURED || !window.firebase) return false;
    try {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();
      mode = 'firebase';
      return true;
    } catch (e) {
      console.warn('Firebase init failed, falling back to the public relay.', e);
      return false;
    }
  }

  function init() {
    if (!initFirebase()) mode = 'ntfy';
    if (channel) {
      channel.onmessage = (ev) => {
        const { sessionId, payload } = ev.data || {};
        const set = listeners.get(sessionId);
        if (set) set.forEach((cb) => cb(payload));
      };
    }
  }

  function push(sessionId, payload) {
    payload.updatedAt = Date.now();
    const json = JSON.stringify(payload);

    // Always mirror to the local channel — instant, free, and helps same-browser testing.
    try {
      localStorage.setItem(`ef_session_${sessionId}`, json);
      channel && channel.postMessage({ sessionId, payload });
    } catch (e) { /* private-browsing storage limits, etc — non-fatal */ }

    if (mode === 'firebase' && db) {
      db.ref(`sessions/${sessionId}`).set(payload);
      return;
    }

    // Real cross-device transport: publish to a public ntfy.sh topic derived
    // from the session ID. Anyone who doesn't know the 6-character session ID
    // can't guess the topic, same trust model as the app's original open
    // Firebase rules — see README.
    fetch(`${NTFY_BASE}/${topicFor(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'Cache': 'no' },
      body: json,
    }).catch(() => { /* offline — local channel above still covers same-browser use */ });
  }

  function subscribe(sessionId, cb) {
    if (!listeners.has(sessionId)) listeners.set(sessionId, new Set());
    listeners.get(sessionId).add(cb);

    const cleanups = [];

    if (mode === 'firebase' && db) {
      const ref = db.ref(`sessions/${sessionId}`);
      ref.on('value', (snap) => cb(snap.val()));
      cleanups.push(() => ref.off('value'));
    } else {
      // 1) Pick up whatever the sharer already broadcast before we connected.
      fetch(`${NTFY_BASE}/${topicFor(sessionId)}/json?poll=1&since=10m`)
        .then((r) => r.text())
        .then((text) => {
          const lines = text.trim().split('\n').filter(Boolean);
          const last = lines[lines.length - 1];
          if (!last) return;
          const msg = JSON.parse(last);
          if (msg.message) cb(JSON.parse(msg.message));
        })
        .catch(() => {});

      // 2) Live updates via Server-Sent Events (auto-reconnects on drop).
      let es = null;
      if ('EventSource' in window) {
        es = new EventSource(`${NTFY_BASE}/${topicFor(sessionId)}/sse`);
        es.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.event === 'message' && msg.message) cb(JSON.parse(msg.message));
          } catch (err) { /* ignore malformed/keepalive frames */ }
        };
        cleanups.push(() => es.close());
      }

      // 3) Also poll localStorage, in case the "other device" is a second tab.
      const key = `ef_session_${sessionId}`;
      const poll = setInterval(() => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) cb(JSON.parse(raw));
        } catch (e) {}
      }, 1500);
      cleanups.push(() => clearInterval(poll));
    }

    return () => {
      const set = listeners.get(sessionId);
      if (set) { set.delete(cb); if (!set.size) listeners.delete(sessionId); }
      cleanups.forEach((fn) => fn());
    };
  }

  function endSession(sessionId) {
    if (mode === 'firebase' && db) db.ref(`sessions/${sessionId}`).remove();
    localStorage.removeItem(`ef_session_${sessionId}`);
  }

  return { init, push, subscribe, endSession, get mode() { return mode; } };
})();

/* =========================================================
   GEOLOCATION WRAPPER
   ========================================================= */
const Geo = {
  watchId: null,
  supported: 'geolocation' in navigator,
  start(onUpdate, onError) {
    if (!this.supported) { onError && onError('unsupported'); return; }
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => onUpdate(pos),
      (err) => onError && onError(err.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
    );
  },
  stop() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  },
};

/* =========================================================
   CONNECTION / OFFLINE HANDLING
   ========================================================= */
const ConnectionWatcher = {
  init() {
    window.addEventListener('online', () => Toast.show('success', "You're back online", 'Live sync resumed.'));
    window.addEventListener('offline', () => Toast.show('error', 'Offline', 'Location sync paused until connection returns.'));
  },
  get online() { return navigator.onLine; },
};

/* =========================================================
   MAP CONTROLLER (Leaflet + street map + OSRM routing)
   ========================================================= */
function MapController(elId) {
  const map = L.map(elId, { zoomControl: false, attributionControl: false });
  map.setView([6.9271, 79.8612], 15); // sensible default; recentres on first fix

  // A normal street map (roads, buildings, labels) is far more useful than
  // satellite imagery for short-distance navigation — you can actually see
  // which street/building to walk toward instead of guessing from rooftops.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  let meMarker = null, targetMarker = null, meAccuracy = null, routingControl = null;
  let autoFollow = true;

  // If the person manually pans/zooms, stop yanking the map back on every GPS
  // tick — respect their intent until they tap a locate button again.
  map.on('dragstart', () => { autoFollow = false; });

  function pulseIcon(cls) {
    return L.divIcon({
      className: '',
      html: `<div class="marker-pulse ${cls}"><div class="ring"></div><div class="dot"></div></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  function setMe(lat, lng, accuracy) {
    const isFirstMe = !meMarker;
    if (!meMarker) {
      meMarker = L.marker([lat, lng], { icon: pulseIcon('me') }).addTo(map);
    } else {
      meMarker.setLatLng([lat, lng]);
    }
    if (accuracy) {
      if (!meAccuracy) meAccuracy = L.circle([lat, lng], { radius: accuracy, color: '#5b5fef', weight: 1, fillOpacity: 0.08 }).addTo(map);
      else { meAccuracy.setLatLng([lat, lng]); meAccuracy.setRadius(accuracy); }
    }
    if (autoFollow) {
      if (isFirstMe && targetMarker && !hasFitOnce) { hasFitOnce = true; fitBoth(true); }
      else if (!targetMarker) map.panTo([lat, lng]);
    }
    recalcRoute();
  }

  let hasFitOnce = false;
  function setTarget(lat, lng, near = false) {
    const cls = near ? 'target near' : 'target';
    const isFirstTarget = !targetMarker;
    if (!targetMarker) {
      targetMarker = L.marker([lat, lng], { icon: pulseIcon(cls) }).addTo(map);
    } else {
      targetMarker.setLatLng([lat, lng]);
      targetMarker.setIcon(pulseIcon(cls));
    }
    recalcRoute();
    if (autoFollow) {
      if (isFirstTarget && meMarker && !hasFitOnce) { hasFitOnce = true; fitBoth(true); }
      else fitBoth();
    }
  }

  function fitBoth(animate = false) {
    if (meMarker && targetMarker) {
      const bounds = L.latLngBounds([meMarker.getLatLng(), targetMarker.getLatLng()]);
      if (animate) map.flyToBounds(bounds, { padding: [70, 70], maxZoom: 18, duration: 0.8 });
      else map.fitBounds(bounds, { padding: [70, 70], maxZoom: 18 });
    }
  }

  let routeDebounce = null;
  function recalcRoute() {
    if (!meMarker || !targetMarker) return;
    clearTimeout(routeDebounce);
    routeDebounce = setTimeout(() => {
      try {
        if (!routingControl) {
          routingControl = L.Routing.control({
            waypoints: [meMarker.getLatLng(), targetMarker.getLatLng()],
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'foot' }),
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: false,
            show: false,
            createMarker: () => null,
            lineOptions: { styles: [{ color: '#22d3ee', opacity: 0.85, weight: 5 }] },
          }).addTo(map);
        } else {
          routingControl.setWaypoints([meMarker.getLatLng(), targetMarker.getLatLng()]);
        }
      } catch (e) { /* OSRM unreachable — straight distance still works via haversine */ }
    }, 600);
  }

  function toggleFollow(v) { autoFollow = v; if (v) fitBoth(); }
  function destroy() { map.remove(); }
  function fullscreen(container) {
    if (!document.fullscreenElement) container.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // "Go to their/my location" — re-enable auto-follow and jump straight there.
  function flyToTarget() {
    if (!targetMarker) return;
    autoFollow = true;
    map.flyTo(targetMarker.getLatLng(), Math.max(map.getZoom(), 17), { duration: 0.6 });
  }
  function flyToMe() {
    if (!meMarker) return;
    autoFollow = true;
    map.flyTo(meMarker.getLatLng(), Math.max(map.getZoom(), 17), { duration: 0.6 });
  }

  // Leaflet caches container size — call this after the map's container
  // changes size outside of Leaflet's own control (e.g. switching into the
  // full-screen tracking layout), or tiles render into the old, smaller box.
  function refreshSize() {
    map.invalidateSize();
    fitBoth();
  }

  return { map, setMe, setTarget, toggleFollow, destroy, fullscreen, fitBoth, flyToTarget, flyToMe, refreshSize };
}

/* =========================================================
   SHARE CONTROLLER
   ========================================================= */
const ShareController = (function () {
  let sessionId = null;
  let sharing = false;
  let unsub = null;
  let unsubTracker = null;
  let mapCtl = null;
  let lastPos = null;
  let lastAccSpeed = { accuracy: null, speed: 0 };
  let trackerPos = null; // the tracker's own live position, if/once they connect
  let hasArrivedShare = false;
  let expiryTimer = null;
  let heartbeatTimer = null;
  const EXPIRY_MIN = 60;
  let expiresAt = null;

  // Mirrors TrackController's own proximity check, run independently on this
  // device so this phone beeps too — not just the tracker's phone.
  function checkProximityShare() {
    if (!lastPos || !trackerPos) return;
    const d = haversineMeters(lastPos.lat, lastPos.lng, trackerPos.lat, trackerPos.lng);
    if (d <= 5 && !hasArrivedShare) {
      hasArrivedShare = true;
      Audio_.startAlarm();
      Toast.show('success', "They're nearby!", 'The person tracking you is within 5 meters.');
    } else if (d > 10 && hasArrivedShare) {
      hasArrivedShare = false;
      Audio_.stopAlarm();
    }
  }

  function ensureSession() {
    if (!sessionId) sessionId = makeSessionId();
    $('#shareSessionId').textContent = sessionId;
    renderQR(sessionId);
  }

  function renderQR(id) {
    const wrap = $('#qrCanvasWrap');
    wrap.innerHTML = '';
    const url = `${location.origin}${location.pathname}#track?sid=${id}`;
    if (window.QRCode) {
      new QRCode(wrap, { text: url, width: 140, height: 140, colorDark: '#0b0f1c', colorLight: '#ffffff' });
    } else {
      wrap.textContent = id;
    }
  }

  function setStatus(chip, label, level) {
    $('#gpsDot').className = `badge-dot ${level}`;
    $('#gpsText').textContent = label;
  }

  function updateAccuracyChip(acc) {
    $('#accuracyText').textContent = acc ? `±${Math.round(acc)} m` : '—';
  }
  function updateCoordsChip(lat, lng) {
    $('#coordsText').textContent = lat != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '—';
  }
  function updateSpeedChip(speed) {
    const kmh = speed ? (speed * 3.6).toFixed(1) : '0.0';
    $('#speedText').textContent = `${kmh} km/h`;
  }
  function updateUpdatedChip() {
    $('#updatedText').textContent = lastPos ? timeAgo(lastPos.t) : '—';
  }

  function startExpiry() {
    expiresAt = Date.now() + EXPIRY_MIN * 60000;
    clearInterval(expiryTimer);
    expiryTimer = setInterval(() => {
      const remain = Math.max(0, expiresAt - Date.now());
      const m = Math.floor(remain / 60000), s = Math.floor((remain % 60000) / 1000);
      $('#sessionExpiry').textContent = `Expires in ${m}:${String(s).padStart(2, '0')}`;
      if (remain <= 0) stopSharing(true);
    }, 1000);
  }

  function start() {
    ensureSession();
    sharing = true;
    $('#startShareBtn').setAttribute('disabled', 'true');
    $('#stopShareBtn').removeAttribute('disabled');
    $('#shareLiveDot').classList.add('good');
    startExpiry();

    if (!mapCtl) mapCtl = MapController('shareMap');

    Geo.start(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords;
        lastPos = { lat, lng, t: Date.now() };
        mapCtl.setMe(lat, lng, accuracy);
        updateAccuracyChip(accuracy);
        updateCoordsChip(lat, lng);
        updateSpeedChip(speed);
        updateUpdatedChip();
        setStatus('#chipGps', accuracy < 20 ? 'Excellent' : accuracy < 50 ? 'Good' : 'Weak', accuracy < 20 ? 'good' : accuracy < 50 ? 'warn' : 'bad');
        lastAccSpeed = { accuracy, speed: speed || 0 };
        SyncLayer.push(sessionId, { lat, lng, accuracy, speed: speed || 0, role: 'sharer' });
        checkProximityShare();
      },
      (err) => {
        if (err === 'denied') {
          Toast.show('error', 'Location permission denied', 'Enable location access in your browser settings to start sharing.');
          setStatus('#chipGps', 'Denied', 'bad');
          stopSharing();
        } else {
          Toast.show('error', 'GPS unavailable', 'We could not get a location fix. Try moving outdoors.');
          setStatus('#chipGps', 'Unavailable', 'bad');
        }
      }
    );

    // Re-broadcast the last known fix every few seconds even if GPS hasn't
    // produced a new one — keeps the tracker's "Last Updated" / connection
    // state from looking stalled or dead when you're standing still.
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!sharing || !lastPos) return;
      updateUpdatedChip();
      SyncLayer.push(sessionId, { lat: lastPos.lat, lng: lastPos.lng, ...lastAccSpeed, role: 'sharer' });
    }, 5000);

    // Listen for the tracker's own live position (pushed on a dedicated
    // channel by TrackController) so this device can work out the distance
    // and beep on its own, independent of the tracker's phone.
    if (unsubTracker) unsubTracker();
    unsubTracker = SyncLayer.subscribe(`${sessionId}_trk`, (data) => {
      if (!data) return;
      trackerPos = data;
      checkProximityShare();
    });

    Toast.show('success', 'Broadcasting started', `Session ${sessionId} is live.`);
    Audio_.success();
  }

  function stopSharing(silentExpiry = false) {
    sharing = false;
    Geo.stop();
    clearInterval(expiryTimer);
    clearInterval(heartbeatTimer);
    if (unsubTracker) { unsubTracker(); unsubTracker = null; }
    trackerPos = null;
    hasArrivedShare = false;
    Audio_.stopAlarm();
    $('#startShareBtn').removeAttribute('disabled');
    $('#stopShareBtn').setAttribute('disabled', 'true');
    $('#shareLiveDot').classList.remove('good');
    $('#sessionExpiry').textContent = 'Not sharing';
    if (sessionId) SyncLayer.endSession(sessionId);
    if (silentExpiry) Toast.show('info', 'Session expired', 'Start a new share to get a fresh Session ID.');
    else Toast.show('info', 'Sharing stopped', 'Your location is no longer visible.');
  }

  function copyId() {
    if (!sessionId) return;
    navigator.clipboard?.writeText(sessionId).then(() => Toast.show('success', 'Copied', 'Session ID copied to clipboard.'));
  }
  function shareId() {
    if (!sessionId) return;
    const url = `${location.origin}${location.pathname}#track?sid=${sessionId}`;
    if (navigator.share) navigator.share({ title: 'Elite Find', text: `Track me on Elite Find — Session ${sessionId}`, url });
    else copyId();
  }

  function onEnterView() { ensureSession(); }

  function bindUI() {
    $('#startShareBtn').addEventListener('click', start);
    $('#stopShareBtn').addEventListener('click', () => stopSharing());
    $('#copyIdBtn').addEventListener('click', copyId);
    $('#shareLinkBtn').addEventListener('click', shareId);
    $('#shareLocateBtn')?.addEventListener('click', () => {
      if (!mapCtl) { Toast.show('info', 'Not sharing yet', 'Tap Start Sharing first.'); return; }
      mapCtl.flyToMe();
    });
  }

  return { bindUI, onEnterView };
})();

/* =========================================================
   TRACK CONTROLLER
   ========================================================= */
const TrackController = (function () {
  let sessionId = null;
  let unsub = null;
  let mapCtl = null;
  let hasArrived = false;
  let myPos = null;
  let lastTargetPos = null;
  let deviceHeading = null; // compass heading in degrees, null if unavailable
  let trackerHeartbeat = null; // keeps the sharer's proximity check fed with our position

  function handleOrientation(e) {
    let heading = null;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      heading = e.webkitCompassHeading; // iOS Safari: already clockwise-from-north
    } else if (typeof e.alpha === 'number' && !isNaN(e.alpha)) {
      heading = (360 - e.alpha) % 360; // Android/others: alpha is counter-clockwise
    }
    if (heading == null) return;
    deviceHeading = heading;
    updateCompass();
  }

  function startCompass() {
    // iOS 13+ requires this to be called directly inside a user gesture —
    // connect() is only ever invoked from a click handler, so this qualifies.
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((state) => { if (state === 'granted') window.addEventListener('deviceorientation', handleOrientation, true); })
        .catch(() => {});
    } else if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    } else if ('ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
  }

  function stopCompass() {
    window.removeEventListener('deviceorientation', handleOrientation, true);
    window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
    deviceHeading = null;
  }

  function updateCompass() {
    const arrow = $('#compassArrowSvg');
    const label = $('#compassLabel');
    const widget = $('#trackCompass');
    if (!arrow || !label) return;
    if (!myPos || !lastTargetPos) { label.textContent = 'Waiting for GPS…'; return; }
    const bearing = bearingDeg(myPos.latitude, myPos.longitude, lastTargetPos.lat, lastTargetPos.lng);
    const rotation = deviceHeading != null ? bearing - deviceHeading : bearing;
    arrow.style.transform = `rotate(${rotation}deg)`;
    label.textContent = deviceHeading != null ? 'Walk this way' : 'Point phone up →';
    widget?.classList.toggle('near', hasArrived);
  }

  function showState(name) {
    $$('.track-state').forEach((s) => s.classList.remove('active'));
    const el = $(`#trackState-${name}`);
    if (el) el.classList.add('active');
  }

  function collectOtp() {
    return $$('.otp-input input').map((i) => i.value.trim().toUpperCase()).join('');
  }

  function bindOtp() {
    const inputs = $$('.otp-input input');
    inputs.forEach((inp, idx) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.toUpperCase().slice(-1);
        if (inp.value && inputs[idx + 1]) inputs[idx + 1].focus();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && inputs[idx - 1]) inputs[idx - 1].focus();
      });
      inp.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        inputs.forEach((box, i) => (box.value = text[i] || ''));
      });
    });
  }

  function connect(id) {
    // Clean up any previous attempt first — without this, retrying after a
    // timeout/error left the old subscription and GPS watch running forever
    // in the background (battery drain + confusing duplicate callbacks).
    teardownAttempt();

    sessionId = id;
    showState('searching');
    Audio_.click();

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) fail('Session not found. Make sure the sharer has tapped "Start Sharing" and double-check the code.');
    }, 15000);

    unsub = SyncLayer.subscribe(sessionId, (data) => {
      if (!data) return;
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        onConnected();
      }
      onData(data);
    });

    startCompass();

    // Start my own geolocation too, so distance/route can be computed both ways
    Geo.start(
      (pos) => {
        myPos = pos.coords;
        if (mapCtl) mapCtl.setMe(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        // Publish my own position on a dedicated channel so the sharer's
        // device can independently work out the distance and beep too.
        SyncLayer.push(`${sessionId}_trk`, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          role: 'tracker',
        });
        checkProximity();
        updateCompass();
      },
      (err) => {
        if (err === 'denied') Toast.show('error', 'Location permission needed', 'Allow location access to see your position and distance on the map.');
      }
    );

    // Re-publish my last known fix every few seconds even without a fresh GPS
    // tick, mirroring the sharer's own heartbeat — keeps the sharer's device
    // from seeing my position go stale if I'm standing still.
    clearInterval(trackerHeartbeat);
    trackerHeartbeat = setInterval(() => {
      if (!myPos) return;
      SyncLayer.push(`${sessionId}_trk`, {
        lat: myPos.latitude,
        lng: myPos.longitude,
        accuracy: myPos.accuracy,
        role: 'tracker',
      });
    }, 5000);
  }

  function teardownAttempt() {
    unsub && unsub();
    unsub = null;
    Geo.stop();
    stopCompass();
    clearInterval(trackerHeartbeat);
    trackerHeartbeat = null;
    Audio_.stopAlarm();
    // The full-screen map only makes sense while actively connected —
    // drop it whenever a connection attempt is torn down (retry, error,
    // or manual disconnect all funnel through here).
    document.body.classList.remove('map-immersive');
  }

  function onConnected() {
    showState('connected');
    if (!mapCtl) mapCtl = MapController('trackMap');
    document.body.classList.add('map-immersive');
    // Let the layout settle into full-screen before telling Leaflet to
    // re-measure its container, or the map renders at the old, smaller size.
    requestAnimationFrame(() => setTimeout(() => mapCtl.refreshSize(), 60));
    Toast.show('success', 'Connected', `Live-tracking session ${sessionId}.`);
    Audio_.success();
  }

  function onData(data) {
    lastTargetPos = data;
    if (mapCtl) mapCtl.setTarget(data.lat, data.lng, hasArrived);
    $('#trackUpdated').textContent = timeAgo(data.updatedAt);
    checkProximity();
    updateCompass();
  }

  function checkProximity() {
    if (!myPos || !lastTargetPos) return;
    const d = haversineMeters(myPos.latitude, myPos.longitude, lastTargetPos.lat, lastTargetPos.lng);
    $('#trackDistance').textContent = fmtDistance(d);
    $('#trackEta').textContent = fmtETA(d);
    if (d <= 5 && !hasArrived) {
      hasArrived = true;
      // Keeps beeping (not just once) until they disconnect or move apart.
      Audio_.startAlarm();
      if (mapCtl) mapCtl.setTarget(lastTargetPos.lat, lastTargetPos.lng, true);
      Modal.show({
        icon: 'success',
        title: "You're nearby!",
        body: "You're within 5 meters of each other. Look around — they're close!",
        actionLabel: 'Got it',
      });
    } else if (d > 10 && hasArrived) {
      hasArrived = false; // reset so it can trigger again later
      Audio_.stopAlarm();
      $('#trackCompass')?.classList.remove('near');
      if (mapCtl) mapCtl.setTarget(lastTargetPos.lat, lastTargetPos.lng, false);
    }
  }

  function fail(message) {
    teardownAttempt();
    showState('error');
    $('#trackErrorMsg').textContent = message;
    Audio_.error();
  }

  function disconnect() {
    teardownAttempt();
    hasArrived = false;
    myPos = null; lastTargetPos = null;
    const label = $('#compassLabel');
    if (label) label.textContent = 'Waiting for GPS…';
    $('#trackCompass')?.classList.remove('near');
    showState('entry');
  }

  function onEnterView() {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const sid = params.get('sid');
    if (sid) {
      const inputs = $$('.otp-input input');
      sid.split('').forEach((ch, i) => inputs[i] && (inputs[i].value = ch));
      connect(sid);
    }
  }

  function bindUI() {
    bindOtp();
    showState('entry');
    $('#connectBtn').addEventListener('click', () => {
      const id = collectOtp();
      if (id.length < 6) {
        Toast.show('error', 'Incomplete code', 'Enter all 6 characters of the Session ID.');
        return;
      }
      connect(id);
    });
    $('#disconnectBtn').addEventListener('click', disconnect);
    $('#retryBtn').addEventListener('click', () => {
      teardownAttempt();
      showState('entry');
    });
    $('#locateTargetBtn')?.addEventListener('click', () => {
      if (!mapCtl || !lastTargetPos) { Toast.show('info', 'Not connected yet', 'Waiting for their location to come in.'); return; }
      mapCtl.flyToTarget();
    });
    $$('.map-fullscreen-btn').forEach((b) => b.addEventListener('click', (e) => {
      const frame = e.target.closest('.map-frame');
      if (mapCtl) mapCtl.fullscreen(frame);
    }));
  }

  return { bindUI, onEnterView };
})();

/* =========================================================
   PWA INSTALL PROMPT
   ========================================================= */
const PWA = {
  deferred: null,
  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e;
      $('#installBanner').classList.add('show');
    });
    $('#installBtn')?.addEventListener('click', async () => {
      if (!this.deferred) return;
      this.deferred.prompt();
      await this.deferred.userChoice;
      this.deferred = null;
      $('#installBanner').classList.remove('show');
    });
    $('#dismissInstall')?.addEventListener('click', () => $('#installBanner').classList.remove('show'));
    window.addEventListener('appinstalled', () => Toast.show('success', 'Installed', 'Elite Find added to your home screen.'));
  },
};

/* =========================================================
   ANIMATED COUNTERS (hero stats)
   ========================================================= */
function animateCounters() {
  $$('.stat b[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const decimals = el.dataset.count.includes('.') ? 1 : 0;
    let start = 0;
    const dur = 1400;
    const t0 = performance.now();
    function frame(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

/* =========================================================
   BOOT
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  Modal.init();
  ThemeManager.init();
  Router.init();
  ConnectionWatcher.init();
  SyncLayer.init();
  PWA.init();
  ShareController.bindUI();
  TrackController.bindUI();
  animateCounters();

  $('#navToggle')?.addEventListener('click', () => $('#navLinks').classList.toggle('open'));

  if (!Geo.supported) {
    Toast.show('error', 'Geolocation unsupported', 'Your browser does not support location tracking.');
  }
  if (SyncLayer.mode === 'ntfy') {
    setTimeout(() => Toast.show('info', 'Live sync ready', 'Using a free public relay — works across real devices. Add your own Firebase credentials in firebase-config.js for a private backend.'), 900);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* served from file://, ignore */ });
  }
});
