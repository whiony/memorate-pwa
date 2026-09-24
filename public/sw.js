const CACHE = "memorate-shell-v5";
const STATIC = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

function assetURL(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin || url.username || url.password || url.search || url.hash) return null;
    // Framework prefixes also contain dynamic endpoints: only cache static files.
    return STATIC.includes(url.pathname) || /^\/(?:_next\/static|_vinext|assets)\/.+\.(?:js|css|woff2?)$/.test(url.pathname) ? url : null;
  } catch { return null; }
}

function cacheable(response) {
  return response.ok && !response.redirected && response.type !== "opaque" &&
    !/\b(?:private|no-store|no-cache)\b/i.test(response.headers.get("Cache-Control") || "") &&
    !response.headers.has("Set-Cookie") &&
    !(response.headers.get("Vary") || "").split(",").some(value => ["*", "cookie", "authorization"].includes(value.trim().toLowerCase()));
}

async function precache(cache, value) {
  const url = assetURL(value);
  if (!url) return;
  const response = await fetch(url.href, { credentials: "omit", redirect: "error" });
  if (cacheable(response)) await cache.put(url.href, response);
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // The private Sites gateway needs the session cookie even though the root
    // shell has no server-rendered identity or collection data. Only the app's
    // explicit invariant-shell marker may authorize this cache; never auth pages.
    const response = await fetch("/", { credentials: "same-origin", redirect: "error" });
    const shell = response.ok && !response.redirected && response.headers.get("X-Memorate-Offline-Shell") === "1" && !response.headers.has("Set-Cookie");
    if (shell && response.headers.get("Content-Type")?.includes("text/html")) {
      await cache.put("/", response.clone());
      const html = await response.text();
      const paths = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]);
      await Promise.allSettled([...new Set([...STATIC, ...paths])].slice(0, 128).map(path => precache(cache, path)));
    }
    // Wait for explicit activation so an open editor is never interrupted.
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE && name.startsWith("memorate-shell-")) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE") { event.waitUntil(self.skipWaiting()); return; }
  if (event.data?.type !== "PRECACHE" || !Array.isArray(event.data.assets) || event.data.assets.length > 128) return;
  event.waitUntil((async () => {
    const client = event.source?.id && await self.clients.get(event.source.id);
    if (!client || new URL(client.url).origin !== self.location.origin) return;
    const cache = await caches.open(CACHE);
    await Promise.allSettled([...new Set(event.data.assets)].map(value => precache(cache, value)));
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("Authorization")) return;
  if (request.mode === "navigate") {
    // Auth routes, query strings, and other pages must never use the offline shell.
    if (url.pathname !== "/" || url.search) return;
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch { return (await (await caches.open(CACHE)).match("/")) || Response.error(); }
    })());
    return;
  }
  if (!assetURL(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  })());
});
