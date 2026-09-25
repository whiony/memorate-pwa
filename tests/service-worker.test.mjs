import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const origin = 'https://memorate.test';
function worker() {
  const handlers = {}, stored = new Map(), calls = [];
  let response = new Response('ok');
  const key = value => typeof value === 'string' ? value : value.url;
  const cache = { match: async value => stored.get(key(value)), put: async (value, result) => stored.set(key(value), result) };
  const context = vm.createContext({ URL, Response, Promise, Set,
    self: { location: { origin }, addEventListener: (name, fn) => handlers[name] = fn,
      skipWaiting: async () => {}, clients: { claim: async () => {}, get: async id => id === 'trusted' ? { url: origin } : undefined } },
    caches: { open: async () => cache, keys: async () => ['memorate-shell-v3'], delete: async name => calls.push(['delete', name]) },
    fetch: async (...args) => { calls.push(args); if (response instanceof Error) throw response; return response.clone(); },
  });
  vm.runInContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  return { handlers, stored, calls, respond: value => response = value,
    async navigate(path) { let result; handlers.fetch({ request: { url: origin + path, mode: 'navigate', method: 'GET', headers: new Headers() }, respondWith: promise => result = promise }); return result; },
    async message(assets, id = 'trusted') { let pending; handlers.message({ data: { type: 'PRECACHE', assets }, source: { id }, waitUntil: promise => pending = promise }); await pending; },
    async run(name) { let pending; handlers[name]({ waitUntil: promise => pending = promise }); await pending; },
  };
}

test('auth and query navigations bypass offline shell; root still works offline', async () => {
  const w = worker(); w.stored.set('/', new Response('anonymous shell')); w.respond(new Error('offline'));
  for (const path of ['/callback?code=secret', '/signin-with-chatgpt', '/account', '/shared/secret', '/api/shared/secret/photos/0', '/?token=secret']) assert.equal(await w.navigate(path), undefined);
  assert.equal(await (await w.navigate('/')).text(), 'anonymous shell');
});
test('online navigation cannot overwrite the anonymous cached shell', async () => {
  const w = worker(); w.stored.set('/', new Response('shell')); w.respond(new Response('private page'));
  assert.equal(await (await w.navigate('/')).text(), 'private page');
  assert.equal(await w.stored.get('/').text(), 'shell');
});
test('precache rejects dynamic endpoints, foreign URLs, malformed URLs and query strings', async () => {
  const w = worker();
  await w.message(['https://evil.test/x.js', '/api/export.js', '/shared/secret', '/api/shared/secret/photos/0', '/_next/image', '/_next/static/x.js?token=secret', 'http://[', null, '/assets/app.js', '/_next/static/chunks/a.js']);
  assert.deepEqual(w.calls.map(call => call[0]), [origin + '/assets/app.js', origin + '/_next/static/chunks/a.js']);
});
test('precache requires a controlled same-origin client and bounds each batch', async () => {
  const w = worker(); await w.message(['/assets/app.js'], 'unknown'); await w.message(Array(129).fill('/assets/app.js'));
  assert.equal(w.calls.length, 0);
});
test('private and session-dependent responses are never stored', async () => {
  for (const headers of [{ 'Cache-Control': 'private' }, { 'Cache-Control': 'no-store' }, { 'Set-Cookie': 'session=x' }, { Vary: 'Cookie' }, { Vary: '*' }]) {
    const w = worker(); w.respond(new Response('secret', { headers })); await w.message(['/assets/app.js']); assert.equal(w.stored.size, 0);
  }
});
test('installation fetches explicitly marked identity-free shell without following redirects; upgrades delete old cache', async () => {
  const w = worker(); w.respond(new Response('<script src="/assets/app.js"></script>', { headers: { 'Content-Type': 'text/html', 'X-Memorate-Offline-Shell': '1' } }));
  await w.run('install'); assert.equal(w.calls[0][1].credentials, 'same-origin'); assert.equal(w.calls[0][1].redirect, 'error'); assert.ok(w.stored.has('/'));
  await w.run('activate'); assert.ok(w.calls.some(call => call[0] === 'delete' && call[1] === 'memorate-shell-v3'));
});

test('installation never stores an unmarked login or personalized page', async () => { const w=worker();w.respond(new Response('private account',{headers:{'Content-Type':'text/html'}}));await w.run('install');assert.equal(w.stored.size,0); });
