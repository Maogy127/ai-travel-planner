// Free AI: Firebase AI Logic with the Gemini Developer API on the no-cost Spark plan (project gonow-8e9e8).
// No billing account. At the free limit the app pauses AI and keeps the rule-based planner and simple edits.
// App Check is enforced for AI Logic: put the public reCAPTCHA site key registered in Firebase App Check here
// (appCheckProvider 'v3' for reCAPTCHA v3, 'enterprise' for reCAPTCHA Enterprise). Without it AI stays off.
window.GONOW_AI_CONFIG = { enabled: true, model: 'gemini-3.5-flash-lite', sdk: 'https://www.gstatic.com/firebasejs/13.4.0/', appCheckSiteKey: '', appCheckProvider: 'v3', deviceDailyLimit: 25, timeoutMs: 15000 };
