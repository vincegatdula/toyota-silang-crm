/* ============================================================
   Toyota CRM — service worker
   Static app shell caching for offline use.
   Data itself lives in IndexedDB and does not require network.
   ============================================================ */
const CACHE = 'toyota-crm-v2';
const STATIC = [
  'index.html',
  'dashboard.html', 'leads.html', 'kanban.html', 'activities.html',
  'calendar.html', 'targets.html', 'reports.html', 'archived.html', 'settings.html',
  'css/style.css', 'css/dashboard.css', 'css/leads.css', 'css/kanban.css',
  'css/calendar.css', 'css/pages.css', 'css/responsive.css',
  'js/utils.js', 'js/storage.js', 'js/app.js', 'js/leadview.js',
  'js/dashboard.js', 'js/leads.js', 'js/kanban.js', 'js/activities.js',
  'js/calendar.js', 'js/targets.js', 'js/reports.js', 'js/settings.js', 'js/archived.js',
  'js/activity-service.js',
  'manifest.json',
  'assets/icons/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Network-first for navigations so updates are picked up; fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('dashboard.html')))
    );
    return;
  }

  // Cache-first for static assets.
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});