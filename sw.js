// Service worker: cache-first voor alle app-assets (offline-first, de app
// haalt geen externe data op). VERSIE is tegelijk cachenaam en updatesignaal;
// nergens anders in de code staat een versienummer.
const VERSIE = '1.1.0';
const CACHE = `kbc-cashflow-${VERSIE}`;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/stijl.css',
  'iconen/icoon.svg',
  'iconen/icoon-180.png',
  'js/app.js',
  'js/backup.js',
  'js/categories.js',
  'js/chart.js',
  'js/csv.js',
  'js/db.js',
  'js/dom.js',
  'js/flows.js',
  'js/format.js',
  'js/import.js',
  'js/meldingen.js',
  'js/normalize.js',
  'js/periods.js',
  'js/recurring.js',
  'js/router.js',
  'js/rules.js',
  'js/stats.js',
  'js/suggestions.js',
  'js/views/catkeuze.js',
  'js/views/dashboard.js',
  'js/views/detail.js',
  'js/views/importflow.js',
  'js/views/instellingen.js',
  'js/views/regels.js',
  'js/views/transacties.js',
  'js/views/werklijst.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((namen) => Promise.all(
    namen.filter((naam) => naam !== CACHE).map((naam) => caches.delete(naam)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  // De updatecheck (cache-gebuste fetch van sw.js) nooit onderscheppen.
  if (event.request.url.includes('sw.js')) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true })
    .then((antwoord) => antwoord ?? fetch(event.request)));
});
