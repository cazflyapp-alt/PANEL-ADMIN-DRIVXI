/* ============================================================
   Drivxi - Service Worker (PWA)
   - Precachea el "app shell": index.html, manifest.json e iconos.
   - Permite abrir el panel sin conexión (fallback al shell).
   - Los recursos externos (CDN Tailwind, Supabase, Google Fonts)
     siempre se piden directo a la red.
   ============================================================ */

const CACHE_NAME = 'drivxi-panel-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* Instalación: precachear el app shell y activar de inmediato */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* Activación: eliminar cachés de versiones anteriores */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* Estrategia de caché según el tipo de petición */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo se interceptan peticiones GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) Navegaciones (abrir la app): network-first con fallback al shell cacheado
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) =>
            hit || caches.match(new URL('index.html', self.registration.scope))
          )
        )
    );
    return;
  }

  // 2) Archivos del propio origen (GitHub Pages): cache-first,
  //    actualizando la caché en segundo plano
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const desdeRed = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copia = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
            }
            return response;
          })
          .catch(() => cached);
        return cached || desdeRed;
      })
    );
    return;
  }

  // 3) Recursos cross-origin (CDN, Supabase, fuentes): se dejan pasar
  //    directo a la red (comportamiento por defecto del navegador).
});
