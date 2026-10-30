// Service worker : l'appli s'ouvre même sans réseau.
// Change VERSION à chaque mise à jour pour forcer le rafraîchissement.
const VERSION = 'amenhub-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/config.js', './js/db.js', './js/ui.js', './js/dates.js', './js/ics.js', './js/net.js',
  './js/modules/accueil.js', './js/modules/agenda.js', './js/modules/idees.js', './js/modules/contenus.js',
  './js/modules/plus.js', './js/modules/clients.js', './js/modules/devis.js', './js/modules/tournages.js',
  './js/modules/reseau.js', './js/modules/revisions.js', './js/modules/collection.js',
  './icons/icon-192.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Données Supabase : jamais en cache ici (l'appli gère son propre cache)
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;

  // Fichiers de l'appli : réseau d'abord (pour avoir la dernière version), cache si hors ligne
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Bibliothèques et polices (CDN) : cache d'abord
  if (/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res;
    })));
  }
});
