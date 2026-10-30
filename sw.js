// Guarda la app para que abra sin internet.
const CACHE = "rentas-v4";
const ARCHIVOS = ["./", "index.html", "estilos.css", "datos.js", "app.js", "manifest.webmanifest", "icono.svg", "icono-192.png", "lib/fuentes/caprasimo-latin-400-normal.woff2", "lib/fuentes/figtree-latin-400-normal.woff2", "lib/fuentes/figtree-latin-700-normal.woff2",
  "lib/jspdf.umd.min.js"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Primero internet (para recibir mejoras); sin internet, lo guardado.
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && e.request.url.startsWith(self.location.origin)) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
