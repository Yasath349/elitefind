/**
 * Elite Find — Firebase Configuration
 * ------------------------------------
 * 1. Go to https://console.firebase.google.com
 * 2. Create a project → Add a Web App → copy the config object below.
 * 3. Enable "Realtime Database" (NOT Firestore) in test mode (or use the rules
 *    below), and paste your config into FIREBASE_CONFIG.
 *
 * Suggested Realtime Database rules (basic session-scoped access):
 *
 * {
 *   "rules": {
 *     "sessions": {
 *       "$sessionId": {
 *         ".read": true,
 *         ".write": true,
 *         ".validate": "newData.hasChildren(['lat','lng','updatedAt'])"
 *       }
 *     }
 *   }
 * }
 *
 * Until real credentials are added, Elite Find syncs sessions through a free,
 * keyless public relay (ntfy.sh) — this already works between two real
 * devices with zero setup. It also mirrors session data locally via
 * BroadcastChannel + localStorage, so two tabs in the same browser sync
 * instantly too. Add your own Firebase project below only if you want a
 * private backend instead of the shared public relay.
 */

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Elite Find treats the config as "unset" until every YOUR_ placeholder is replaced.
const FIREBASE_IS_CONFIGURED = Object.values(FIREBASE_CONFIG).every(
  (v) => typeof v === "string" && !v.startsWith("YOUR_")
);
