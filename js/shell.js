/* App shell: ☰ menu drawer, in-page Start over, and a once-per-session sign-in nudge. */
(function(){
'use strict';
const app = () => window.__gonow;
const toggle = document.getElementById('nav-toggle'), drawer = document.getElementById('nav-drawer');
function current(){ const s = app()?.state.screen; return s === 'community' || s === 'profile' ? s : s === 'home' ? 'home' : ''; }
function mark(){ drawer.querySelectorAll('[data-nav]').forEach(b => { if (b.dataset.nav === current()) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
function openNav(){ mark(); drawer.showModal(); drawer.classList.add('is-open'); toggle.setAttribute('aria-expanded', 'true'); (drawer.querySelector('[aria-current=page]') || drawer.querySelector('[data-nav]')).focus(); }
function closeNav(){ if (!drawer.open) return; drawer.classList.remove('is-open'); drawer.close(); }
drawer.addEventListener('close', () => { drawer.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); });
toggle.onclick = openNav;
drawer.querySelector('[data-testid=nav-close]').onclick = closeNav;
// The dialog fills the screen; a click outside the panel is the backdrop.
drawer.addEventListener('click', e => { if (!e.target.closest('.nav-panel')) closeNav(); });
// Focus stays inside the drawer (showModal makes the page inert; Tab wraps).
drawer.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const f = [...drawer.querySelectorAll('button')]; const at = f.indexOf(document.activeElement);
  e.preventDefault(); const next = at < 0 ? (e.shiftKey ? f.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + f.length) % f.length; f[next].focus();
});
drawer.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
  const to = b.dataset.nav; closeNav();
  if (to === 'home') app().home(); else app().go(to);
});

// Start over: a small in-page text button only while a trip is in progress.
const confirmBox = document.createElement('dialog'); confirmBox.className = 'confirm-sheet'; confirmBox.dataset.testid = 'start-over-confirm';
confirmBox.setAttribute('aria-labelledby', 'start-over-title');
confirmBox.innerHTML = '<h2 id="start-over-title">Clear this trip and start over?</h2><p class="muted">Your saved trips stay in Your trips.</p><div class="row"><button type="button" class="primary" data-testid="start-over-yes">Start over</button><button type="button" class="outline" data-testid="start-over-no">Cancel</button></div>';
document.body.append(confirmBox);
confirmBox.querySelector('[data-testid=start-over-no]').onclick = () => confirmBox.close();
confirmBox.querySelector('[data-testid=start-over-yes]').onclick = () => { confirmBox.close(); app().restart(); };
function update(){
  const view = document.getElementById('view'); if (!view || !app()) return;
  const want = app().midFlow();
  let bar = view.querySelector('[data-testid=start-over]');
  if (want && !bar) {
    const host = view.querySelector('.shell') || view.firstElementChild || view;
    host.insertAdjacentHTML('afterbegin', '<div class="flow-tools"><button type="button" class="text-button" data-testid="start-over">Start over</button></div>');
    bar = view.querySelector('[data-testid=start-over]');
    bar.onclick = () => confirmBox.showModal();
  } else if (!want && bar) bar.closest('.flow-tools').remove();
  if (drawer.open) mark();
}
new MutationObserver(() => update()).observe(document.getElementById('view'), {childList: true});

// Sign-in nudge: once per session, for guests, when they start planning.
const SEEN = 'gonow:signin-nudge';
const nudge = document.createElement('dialog'); nudge.className = 'nudge-sheet'; nudge.dataset.testid = 'signin-nudge'; nudge.setAttribute('aria-label', 'Sign in');
nudge.innerHTML = '<p>Sign in to sync across devices and plan with friends.</p><div class="row"><button type="button" class="primary" data-testid="nudge-sign-in">Sign in</button><button type="button" class="outline" data-testid="nudge-not-now">Not now</button></div>';
document.body.append(nudge);
let resume = null, waiting = 0, viaButton = false;
const guest = () => !(window.goNowAccount && window.goNowAccount.user);
const seen = () => { try { return sessionStorage.getItem(SEEN) === '1'; } catch (e) { return true; } };
document.addEventListener('click', e => {
  const start = e.target.closest('[data-testid=start-new-trip]');
  if (!start || !guest() || seen()) return;
  // Only once the destination passes the home form's checks, so errors still show first.
  const dest = (document.querySelector('[data-testid=home-destination]') || {}).value;
  if (dest !== undefined && (!String(dest).trim() || (window.GoNowPlaces && window.GoNowPlaces.isJunk && window.GoNowPlaces.isJunk(dest)))) return;
  try { sessionStorage.setItem(SEEN, '1'); } catch (err) {}
  e.preventDefault(); e.stopImmediatePropagation();
  resume = () => { const b = document.querySelector('[data-testid=start-new-trip]'); if (b) b.click(); else app().startFromHome(); };
  nudge.showModal();
}, true);
// "Not now", Esc or closing the prompt all continue planning; only "Sign in" waits for the sign-in.
nudge.addEventListener('close', () => { if (viaButton) { viaButton = false; return; } const r = resume; resume = null; if (r) r(); });
nudge.querySelector('[data-testid=nudge-not-now]').onclick = () => nudge.close();
nudge.querySelector('[data-testid=nudge-sign-in]').onclick = () => { viaButton = true; nudge.close(); waiting = Date.now(); window.GoNowAccounts?.signin(); };
// After signing in, planning continues with the same answers.
window.addEventListener('gonow:auth', e => {
  // A sign-in long after the prompt (sheet closed, came back later) never starts a trip by surprise.
  if (!waiting || !e.detail) return;
  if (Date.now() - waiting > 10 * 60 * 1000) { waiting = 0; resume = null; return; } waiting = 0;
  // Wait for the sign-in / sync sheet to finish, then continue from the home form.
  let tries = 0; const timer = setInterval(() => {
    const sheet = document.querySelector('[data-testid=sign-in-sheet]');
    if ((sheet && sheet.open) && ++tries < 150) return;
    clearInterval(timer); setTimeout(() => { const r = resume; resume = null; if (r && ['home', 'dashboard'].includes(app().state.screen)) r(); }, 150);
  }, 200);
});
window.GoNowShell = {update, openNav, closeNav};
update();
})();
