/* Service Worker: legt die App (nur Code, keine Daten) im Zwischenspeicher ab, damit sie offline startet. */
const VERSION = 'finanzen-v7';        // bei jeder Änderung an der App hochzählen, dann lädt sich die App selbst neu
const DATEIEN = ['./', 'index.html', 'style.css', 'app.js', 'erfassen.js', 'werkzeuge.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(namen => Promise.all(namen.filter(n => n !== VERSION).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, {ignoreSearch: true}).then(treffer => {
      if (treffer) {                                   // sofort aus dem Speicher, im Hintergrund aktualisieren
        fetch(e.request).then(r => r.ok && caches.open(VERSION).then(c => c.put(e.request, r))).catch(() => {});
        return treffer;
      }
      return fetch(e.request).then(r => {                // Texterkennungs-Dateien beim ersten Gebrauch merken (offline nutzbar)
        if (r.ok && /\/ocr\//.test(e.request.url)) { const k = r.clone(); caches.open(VERSION).then(c => c.put(e.request, k)); }
        return r;
      }).catch(() => caches.match('index.html'));
    })
  );
});
