/* オフライン対応：アプリ本体をキャッシュし、更新があれば裏で取得する */
const CACHE = 'jhs-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css',
  './js/app.js', './js/store.js', './js/utils.js', './js/ui.js', './js/sync.js', './js/sample.js',
  './js/views/dashboard.js', './js/views/companies.js', './js/views/tasks.js',
  './js/views/calendar.js', './js/views/stock.js', './js/views/settings.js',
  './assets/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;  // GitHub API などは素通し

  // ネットワーク優先。オンラインなら常に最新を表示し、
  // オフライン（または通信失敗）のときだけキャッシュを使う。
  // キャッシュ優先にすると、更新しても古い画面が出続けてしまう。
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then(cached => cached || Response.error()))
  );
});
