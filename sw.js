// Service worker: cache-first voor de app-assets; offline toont de app de
// laatst gecachte staat. VERSIE is tegelijk cachenaam en updatesignaal;
// nergens anders in de code staat een versienummer.
const VERSIE = '2.4.0';
const CACHE = `ipt-tracker-${VERSIE}`;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/stijl.css',
  'iconen/icoon.svg',
  'iconen/icoon-180.png',
  'js/afleiden.js',
  'js/app.js',
  'js/dom.js',
  'js/format.js',
  'js/grafiek.js',
  'js/koersen.js',
  'js/meldingen.js',
  'js/opslag.js',
  'js/reken.js',
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
  // De updatecheck (cache-gebuste fetch van sw.js) nooit onderscheppen, en
  // koersverzoeken naar andere domeinen gaan altijd rechtstreeks het net op.
  if (event.request.url.includes('sw.js')) return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true })
    .then((antwoord) => antwoord ?? fetch(event.request)));
});
