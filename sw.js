// Service Worker — Mission Apéro (Lot 4)
// Stratégie :
//  - index.html / navigation : réseau d'abord (pour recevoir les mises à jour), cache en secours
//  - API Supabase REST (missions, cartes) : réseau d'abord, cache en secours (partie jouable hors ligne)
//  - Médias (images, sons, polices, jsQR) : cache d'abord, réseau en secours
const CACHE = 'mission-apero-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll([
        './',
        './index.html',
        'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
      ]).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  const copy = response.clone();
  caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
  return response;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API Supabase REST : réseau d'abord, cache en secours
  if (url.pathname.startsWith('/rest/v1/')) {
    e.respondWith(
      fetch(req).then(r => putInCache(req, r)).catch(() => caches.match(req))
    );
    return;
  }

  // Navigation / index : réseau d'abord, cache en secours
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/admin.html')) {
    e.respondWith(
      fetch(req).then(r => putInCache(req, r))
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // Tout le reste (médias Supabase Storage, polices Google, jsQR) : cache d'abord
  e.respondWith(
    caches.match(req).then(m =>
      m || fetch(req).then(r => {
        if (r.ok || r.type === 'opaque') putInCache(req, r);
        return r;
      })
    )
  );
});
