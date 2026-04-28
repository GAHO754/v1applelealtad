const CACHE_NAME = "applebees-lealtad-v1";

const FILES_TO_CACHE = [
  "/",
  "/login.html",
  "/registro.html",
  "/panel.html",
  "/escanear-ticket.html",
  "/monedero.html",
  "/canjear.html",
  "/historial.html",
  "/cliente.css",
  "/cliente.js",
  "/firebase.js",
  "/ocr.js",
  "/manzanas.png",
  "/manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});