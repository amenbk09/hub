import { configured, sb, getSession, getProfile, signIn, signOut, errMsg } from './db.js';
import { $, $$, h, esc, toast, ICON } from './ui.js';
import { APP_NAME } from './config.js';

// Chaque module exporte render(container, ctx)
const ROUTES = {
  accueil:   { label: 'Accueil',   icon: 'home',   load: () => import('./modules/accueil.js') },
  agenda:    { label: 'Agenda',    icon: 'cal',    load: () => import('./modules/agenda.js') },
  idees:     { label: 'Idées',     icon: 'bulb',   load: () => import('./modules/idees.js'), collab: true },
  contenus:  { label: 'Contenus',  icon: 'film',   load: () => import('./modules/contenus.js') },
  plus:      { label: 'Plus',      icon: 'grid',   load: () => import('./modules/plus.js') },
  clients:   { label: 'Clients',   icon: 'users',  load: () => import('./modules/clients.js'),   parent: 'plus' },
  devis:     { label: 'Devis',     icon: 'doc',    load: () => import('./modules/devis.js'),     parent: 'plus' },
  tournages: { label: 'Tournages', icon: 'camera', load: () => import('./modules/tournages.js'), parent: 'plus' },
  reseau:    { label: 'Réseau',    icon: 'net',    load: () => import('./modules/reseau.js'),    parent: 'plus' },
  revisions: { label: 'Révisions', icon: 'book',   load: () => import('./modules/revisions.js'), parent: 'plus' },
};
export const MORE_ROUTES = ['clients', 'devis', 'tournages', 'reseau', 'revisions'];
const NAV = ['accueil', 'agenda', 'idees', 'contenus', 'plus'];

const app = $('#app');
const ctx = { profile: null, isAdmin: false, cleanup: null };

function setupScreen() {
  app.innerHTML = `<div class="center-screen"><div class="card narrow">
    <h1 class="brand">${esc(APP_NAME)}</h1>
    <p>L'appli n'est pas encore reliée à Supabase.</p>
    <p class="muted small">Ouvre <code>js/config.js</code> et renseigne <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code> (voir le README).</p>
  </div></div>`;
}

function loginScreen() {
  document.body.classList.remove('has-nav');
  app.innerHTML = `<div class="center-screen"><form class="card narrow login" novalidate>
    <div class="rec-dot" aria-hidden="true"></div>
    <h1 class="brand">${esc(APP_NAME)}</h1>
    <p class="muted">Connecte-toi pour continuer.</p>
    <div class="field"><label for="em">E-mail</label><input id="em" type="email" autocomplete="username" inputmode="email" required></div>
    <div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <button class="btn primary block" type="submit">Se connecter</button>
    <p class="muted small center">Pas de compte ? Demande une invitation à Amen.</p>
  </form></div>`;
  const form = $('form', app);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('button', form); btn.disabled = true; btn.textContent = 'Connexion…';
    try { await signIn($('#em').value.trim(), $('#pw').value); await boot(); }
    catch (err) { toast(errMsg(err), 'err'); btn.disabled = false; btn.textContent = 'Se connecter'; }
  });
}

function shell() {
  document.body.classList.add('has-nav');
  document.body.classList.toggle('collab', !ctx.isAdmin);
  const name = ctx.profile.display_name || '';
  app.innerHTML = `
    <header class="topbar">
      <div class="topbar-title"><span class="rec-dot sm" aria-hidden="true"></span><span id="pageTitle">${esc(APP_NAME)}</span></div>
      <div class="topbar-right">
        <span class="offline-badge">Hors ligne</span>
        <button class="icon-btn" id="logout" aria-label="Se déconnecter" title="Se déconnecter (${esc(name)})">${ICON.out}</button>
      </div>
    </header>
    <main id="view" tabindex="-1"></main>
    ${ctx.isAdmin ? `<nav class="tabbar" aria-label="Navigation">${NAV.map(r =>
      `<a href="#/${r}" data-r="${r}">${ICON[ROUTES[r].icon]}<span>${ROUTES[r].label}</span></a>`).join('')}</nav>` : ''}`;
  $('#logout').onclick = async () => { await signOut(); location.hash = ''; loginScreen(); };
}

async function route() {
  if (!ctx.profile) return;
  let name = (location.hash.replace(/^#\/?/, '').split('?')[0]) || (ctx.isAdmin ? 'accueil' : 'idees');
  if (!ROUTES[name]) name = ctx.isAdmin ? 'accueil' : 'idees';
  if (!ctx.isAdmin && !ROUTES[name].collab) name = 'idees';   // les collègues ne voient que les idées

  const def = ROUTES[name];
  const active = def.parent || name;
  $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.r === active));
  $('#pageTitle').textContent = name === 'idees' ? 'Idées Miadome' : def.label;
  document.title = `${def.label} · ${APP_NAME}`;

  if (ctx.cleanup) { try { ctx.cleanup(); } catch { } ctx.cleanup = null; }
  $$('.sheet-wrap').forEach(s => s.remove());   // ferme les panneaux ouverts en changeant de page
  const view = $('#view');
  view.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  view.scrollTop = 0; window.scrollTo(0, 0);
  try {
    const mod = await def.load();
    view.innerHTML = '';
    view.className = 'view-' + name;
    const cleanup = await mod.render(view, ctx);
    if (typeof cleanup === 'function') ctx.cleanup = cleanup;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><p>Impossible de charger cette page.</p><p class="muted small">${esc(errMsg(e))}</p>
      <button class="btn" onclick="location.reload()">Réessayer</button></div>`;
  }
}

async function boot() {
  if (!configured) return setupScreen();
  const session = await getSession();
  if (!session) return loginScreen();
  try {
    ctx.profile = await getProfile();
  } catch (e) {
    app.innerHTML = `<div class="center-screen"><div class="card narrow"><p>${esc(errMsg(e))}</p>
      <button class="btn primary" onclick="location.reload()">Réessayer</button></div></div>`;
    return;
  }
  if (!ctx.profile) {
    app.innerHTML = `<div class="center-screen"><div class="card narrow"><p>Ton compte n'a pas encore de profil.</p>
      <p class="muted small">As-tu exécuté <code>supabase/schema.sql</code> ?</p><button class="btn" id="lo">Se déconnecter</button></div></div>`;
    $('#lo').onclick = async () => { await signOut(); loginScreen(); };
    return;
  }
  ctx.isAdmin = ctx.profile.role === 'admin';
  shell();
  route();
}

window.addEventListener('hashchange', route);
if (sb) sb.auth.onAuthStateChange(evt => { if (evt === 'SIGNED_OUT') { ctx.profile = null; loginScreen(); } });

// Service worker (cache de l'appli pour l'ouverture hors ligne)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
}

boot();
