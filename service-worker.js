// ═══════════════════════════════════════════════
//  Stroke Fast-Track — Service Worker
//  Estrategia: Cache-First para todos los assets
//  Al actualizar la app, cambiar CACHE_VERSION
// ═══════════════════════════════════════════════

const CACHE_VERSION = 'stroke-ft-v1';

const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Google Fonts (se cachean en primera visita con red)
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;600;700&display=swap'
];

// ── INSTALL: cachear todos los assets al instalar ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // cachear assets locales (obligatorio)
      const localAssets = ASSETS_TO_CACHE.filter(url => url.startsWith('./'));
      return cache.addAll(localAssets).then(() => {
        // cachear fuentes (opcional — puede fallar sin red)
        const remoteAssets = ASSETS_TO_CACHE.filter(url => !url.startsWith('./'));
        return Promise.allSettled(remoteAssets.map(url => cache.add(url)));
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache-First con fallback a red ──
self.addEventListener('fetch', event => {
  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // No está en caché → ir a la red y guardar
      return fetch(event.request)
        .then(response => {
          // Solo cachear respuestas válidas
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => {
          // Sin red y sin caché: para navegación devolver index.html
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
