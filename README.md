# Elite Find

**Find Your People, Instantly.**

A premium, production-styled web app for real-time short-distance location sharing — built for festivals, carnivals, malls, concerts, parks, and anywhere crowds make it easy to lose the person you came with.

One person opens **Share** and gets a unique Session ID (and QR code). Another person opens **Track**, enters that ID, and watches the sharer's live position converge on a satellite map with walking directions — with a soft chime when they're within ~5 meters of each other.

---

## ✨ Features

- Glassmorphic, aurora-lit UI with animated hero, floating cards, and a signature radar/beacon element
- Session-based sharing — no accounts, no sign-up, no persistent history
- Live street map (roads, buildings, labels — not satellite) via Leaflet.js, built for close-range/indoor navigation
- Turn-by-turn walking routes via Leaflet Routing Machine + OSRM, plus a device-compass arrow that points straight at the other person (works even off-road, e.g. across a building or field)
- Real-time sync that **works across real devices out of the box** via a free public relay (ntfy.sh), with optional **Firebase Realtime Database** for a private backend — see below
- QR code generation for instant session sharing
- 5-meter proximity detection with a synthesized Web Audio chime (no external sound files needed)
- GPS accuracy, coordinates, speed, and "last updated" live readouts
- Custom animated states for connecting / searching / connected / error — zero native `alert()` boxes
- Dark / light theme toggle with animated transitions
- Offline detection, automatic reconnect polling, and graceful error UI for every failure mode
- Installable as a PWA (manifest + service worker, app-shell caching)
- Session expiration timer (60 minutes) with automatic cleanup

---

## 🗂 File structure

```
elite-find/
├── index.html          # All views: Home, Share, Track, How It Works, About
├── style.css            # Design system, glassmorphism, animations, responsive layout
├── app.js               # Routing, geolocation, sync layer, map/routing, audio, PWA
├── firebase-config.js   # Firebase credentials (placeholders — see below)
├── manifest.json        # PWA manifest
├── sw.js                # Service worker (app-shell caching)
├── README.md
└── assets/
    ├── icons/icon.svg   # App / brand icon
    ├── sounds/          # Reserved — UI sounds are synthesized in-browser via Web Audio API
    └── images/          # Reserved for future custom illustrations
```

---

## 🚀 Getting started

Elite Find has **no build step**. It's plain HTML/CSS/JS.

1. Open `index.html` directly in a browser, **or** serve the folder with any static server (recommended, since some browsers restrict geolocation/service workers on `file://`):
   ```bash
   npx serve elite-find
   # or
   python3 -m http.server --directory elite-find 8080
   ```
2. Open the app, go to **Share**, tap **Start Sharing**, and allow location access.
3. On a second device or a second browser tab, go to **Track**, enter the Session ID, and connect.

### Works across real devices, no setup required

Out of the box, Elite Find syncs sessions through **ntfy.sh**, a free, keyless public pub/sub relay — one person taps Share on their phone, the other taps Track on theirs, and it just works, no accounts or config needed. Session data is also mirrored locally via `BroadcastChannel` + `localStorage`, so two tabs in the same browser sync instantly as well.

Because ntfy.sh is a shared public relay, treat the 6-character Session ID as a shared secret (same trust model as the open Firebase rules below) — anyone with the ID can read that session while it's live, and sessions auto-expire after 60 minutes.

### Connecting your own Firebase backend (optional, for a private relay)

If you'd rather not rely on the shared public relay, you can point Elite Find at your own Firebase project instead:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Add a **Web App** and copy the config object it gives you.
3. Enable **Realtime Database** (not Firestore) in your project.
4. Paste your config into `firebase-config.js`, replacing the `YOUR_...` placeholders.
5. Set your database rules (a starting point is included as a comment in `firebase-config.js`):
   ```json
   {
     "rules": {
       "sessions": {
         "$sessionId": {
           ".read": true,
           ".write": true,
           ".validate": "newData.hasChildren(['lat','lng','updatedAt'])"
         }
       }
     }
   }
   ```

Once configured, `SyncLayer` in `app.js` automatically switches from local demo mode to Firebase — nothing else in the app needs to change.

> **Note on rules above:** open read/write is meant to get you running quickly. For a public deployment, tighten these — for example, require Firebase Anonymous Auth and scope writes to the session's creator.

---

## 🧠 How the pieces fit together

- **`Router`** — a tiny hash-based SPA router that swaps `.view` sections (Home / Share / Track / How It Works / About).
- **`Geo`** — wraps `navigator.geolocation.watchPosition` with sane defaults (high accuracy, 2s max age).
- **`SyncLayer`** — a transport-agnostic interface (`push`, `subscribe`, `endSession`) backed by Firebase if configured, otherwise the public ntfy.sh relay (plus an always-on local `BroadcastChannel` mirror for same-browser testing).
- **`MapController`** — one Leaflet map instance per screen (Share/Track), with pulsing custom markers, an accuracy circle, and debounced OSRM route recalculation.
- **`ShareController` / `TrackController`** — screen-level state machines that wire geolocation + SyncLayer + MapController together, and drive the UI (status chips, OTP entry, connection states).
- **`Audio_`** — synthesizes all UI sounds (click, success, error, notification, arrival chime) with the Web Audio API, so no binary sound assets are required.
- **`Toast` / `Modal`** — shared UI primitives used for every success/error/info state instead of native browser dialogs.

---

## ⚠️ Known limitations

- OSRM's public demo routing server (`router.project-osrm.org`) is rate-limited and best-effort; for production use, self-host OSRM or use a commercial routing API.
- The default sync relay (ntfy.sh) is a **shared public service** — anyone who knows a session's ID can read it while the session is live (60-minute auto-expiry limits exposure). For stricter privacy, configure your own Firebase backend.
- The included Firebase rules (if you opt into Firebase) are permissive (open read/write) to keep setup friction low. Add Firebase Auth before shipping this publicly.
- Geolocation accuracy depends entirely on the user's device and environment (GPS vs. Wi-Fi/IP-based positioning).
- The proximity beep uses the Web Audio API, which mobile browsers only allow after a user gesture — the app unlocks it on first tap, but if a device is in silent/mute mode the OS may still suppress the sound.
- The direction arrow needs device-compass access. iOS Safari will show a one-time permission prompt the first time you connect (tap "Allow"); if you decline, the arrow still shows the direction relative to north instead of relative to which way you're facing.

---

Built with HTML5, CSS3, vanilla ES6+, Leaflet.js, Leaflet Routing Machine, OSRM, and Firebase Realtime Database.
