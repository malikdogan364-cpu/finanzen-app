/* Service Worker: legt die App (nur Code, keine Daten) im Zwischenspeicher ab, damit sie offline startet.
   App-Dateien: zuerst aus dem Netz (immer die neueste Version), ohne Netz aus dem Speicher.
   Texterkennung (ocr/): aus dem Speicher (groß, ändert sich nie). */
const VERSION = 'finanzen-v12';       // bei jeder Änderung an der App hochzählen
const DATEIEN = ['./', 'index.html', 'style.css', 'app.js', 'erfassen.js', 'werkzeuge.js', 'details.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN.map(d => new Request(d, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(namen => Promise.all(namen.filter(n => n !== VERSION).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

function mitZeitlimit(p, ms) { return Promise.race([p, new Promise((_, nein) => setTimeout(() => nein(new Error('zeit')), ms))]); }

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  if (/\/ocr\//.test(e.request.url)) {
    e.respondWith(caches.match(e.request).then(t => t || fetch(e.request).then(r => {
      if (r.ok) { const k = r.clone(); caches.open(VERSION).then(c => c.put(e.request, k)); }
      return r;
    })));
    return;
  }
  e.respondWith(
    mitZeitlimit(fetch(e.request, {cache: 'no-cache'}), 4000).then(r => {
      if (r.ok) { const k = r.clone(); caches.open(VERSION).then(c => c.put(e.request, k)); }
      return r;
    }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(t => t || caches.match('index.html')))
  );
});