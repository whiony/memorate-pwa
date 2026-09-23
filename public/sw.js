const CACHE = "memorate-shell-v1";
const STATIC = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(STATIC);
    // Precache the page's bundled scripts and styles so the first installed launch works offline.
    const response = await cache.match("/");
    if (response) {
      const html = await response.text();
      const paths = [...html.matchAll(/(?:src|href)="(\/[^"?#]+(?:\?[^"#]*)?)"/g)]
        .map(match => match[1]).filter(path => path.startsWith("/_next/") || /\.(?:js|css|woff2?)($|\?)/.test(path));
      await Promise.allSettled([...new Set(paths)].map(path => cache.add(path)));
    }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE && name.startsWith("memorate-shell-")) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type !== "PRECACHE" || !Array.isArray(event.data.assets)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(event.data.assets.filter(value => {
      if (typeof value !== "string") return false;
      const url = new URL(value, self.location.origin);
      return url.origin === self.location.origin && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/_vinext/") || /\.(?:js|css|woff2?)$/.test(url.pathname));
    }).map(value => cache.add(value)));
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try { const response = await fetch(request); if (response.ok) cache.put("/", response.clone()); return response; }
      catch { return (await cache.match("/")) || Response.error(); }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try { const response = await fetch(request); if (response.ok && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest")) cache.put(request, response.clone()); return response; }
    catch { return Response.error(); }
  })());
});
