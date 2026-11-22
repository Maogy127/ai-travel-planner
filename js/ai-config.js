// Free AI: Firebase AI Logic with the Gemini Developer API in its own no-cost Spark project, gonow-ai-cb7a3 (no billing account).
// Accounts, Firestore and Places stay on gonow-8e9e8 (js/firebase-config.js); only the AI uses the project below.
// No billing account. At the free limit the app pauses AI and keeps the rule-based planner and simple edits.
// App Check for AI Logic (on gonow-ai-cb7a3) is Unenforced for the preview; Firebase re-enforces it Jan 21, 2027. Before then register
// reCAPTCHA Enterprise (Fraud Defense) in App Check, put its site key here and use appCheckProvider 'enterprise'.
window.GONOW_AI_CONFIG = { enabled: true, firebase: {"apiKey": "AIzaSyAG88l21lnvCXZ49PdP0VU_lg8OTzJKJbQ", "authDomain": "gonow-ai-cb7a3.firebaseapp.com", "projectId": "gonow-ai-cb7a3", "storageBucket": "gonow-ai-cb7a3.firebasestorage.app", "messagingSenderId": "180020855047", "appId": "1:180020855047:web:5e304460b43aefb1b5c5a2"}, model: 'gemini-3.5-flash-lite', sdk: 'https://www.gstatic.com/firebasejs/13.4.0/', appCheckSiteKey: '', appCheckProvider: 'v3', deviceDailyLimit: 25, timeoutMs: 15000 };
