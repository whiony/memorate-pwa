import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { normalizeBarcode } from '../lib/barcode.ts';
import { OpenFactsProvider, UPCItemDbProvider, LookupError, retryAfter } from '../lib/product-lookup.ts';
import { resolveProducts } from '../lib/product-resolution.ts';
import { ProductLookupService } from '../lib/product-service.ts';
import { D1ProductStore } from '../lib/product-store.ts';
import { noteSchema } from '../lib/data-schema.ts';
const code='0036000291452', product={barcode:code,name:'Tissues',source:'upcitemdb'};
function memory(){const values=new Map();return {values,get:async c=>values.get(c)||null,put:async v=>{values.set(v.product.barcode,v);},reserve:async()=>0,pause:async()=>{}};}
const provider=(id,lookup)=>({id,lookup});
test('GTIN-14 zero padding, EAN-8 padding, UPC-A and UPC-E have equivalent canonical keys',()=>{
 for(const input of ['036000291452','0036000291452','00036000291452'])assert.equal(normalizeBarcode(input),code);
 for(const input of ['96385074','0000096385074','00000096385074'])assert.equal(normalizeBarcode(input),'96385074');
 assert.equal(normalizeBarcode('04252614','UPC_E'),normalizeBarcode('042100005264'));
 assert.equal(normalizeBarcode('10012345000017'),'10012345000017'); // packaging level must not collapse to the consumer item
 assert.equal(normalizeBarcode('10012345000018'),null);
 assert.equal(normalizeBarcode('00000000000000'),null);
});
test('universal v3 lookup follows only approved cross-product redirects and normalizes beauty',async()=>{
 const calls=[];const p=new OpenFactsProvider(async(url)=>{calls.push(url);return calls.length===1?new Response(null,{status:302,headers:{Location:`https://world.openbeautyfacts.org/api/v3/product/${code}?product_type=all`}}):Response.json({product:{code,product_name:'  Face cream ',brands:'Brand',categories:'Face care',image_front_url:'https://images.openbeautyfacts.org/images/products/1/front.400.jpg'}});});
 const found=await p.lookup(code);assert.equal(calls.length,2);assert.match(calls[0],/product_type=all/);assert.equal(found.source,'open-beauty-facts');assert.equal(found.name,'Face cream');assert.equal(found.brand,'Brand');assert.ok(found.imageUrl);
 await assert.rejects(()=>new OpenFactsProvider(async()=>new Response(null,{status:302,headers:{Location:'https://127.0.0.1/internal'}})).lookup(code),/redirect/);
});
test('UPCitemdb normalizes an exact match without requiring an image and ignores mismatched results',async()=>{
 let url;const p=new UPCItemDbProvider(async u=>{url=u;return Response.json({code:'OK',items:[{ean:'3017620422003',title:'Wrong product'},{upc:'036000291452',title:' Tissues ',brand:'Kleenex',category:'Household',images:[]}]});});
 const found=await p.lookup('036000291452');assert.equal(found.name,'Tissues');assert.equal(found.imageUrl,undefined);assert.equal(found.source,'upcitemdb');assert.match(url,/prod\/trial\/lookup\?upc=0036000291452/);
 assert.equal(await new UPCItemDbProvider(async()=>Response.json({code:'OK',items:[{ean:'3017620422003',title:'Wrong'}]})).lookup(code),null);
});
test('404 and empty results are not errors; 429 honors Retry-After and reset headers',async()=>{
 for(const Provider of [OpenFactsProvider,UPCItemDbProvider]) {
  assert.equal(await new Provider(async()=>new Response(null,{status:404})).lookup(code),null);
  await assert.rejects(()=>new Provider(async()=>new Response(null,{status:429,headers:{'Retry-After':'120'}})).lookup(code),e=>e.status===429&&e.retryAfter===120);
 }
 assert.equal(retryAfter(new Response(null,{headers:{'X-RateLimit-Reset':'130'}}),100000),30);
 assert.equal(retryAfter(new Response(null,{headers:{'Retry-After':new Date(140000).toUTCString()}}),100000),40);
 assert.equal(await new UPCItemDbProvider(async()=>Response.json({code:'OK',items:[]})).lookup(code),null);
});
test('timeouts, malformed JSON, HTTP errors fall through to the next provider',async()=>{
 for(const failure of [async()=>{throw new DOMException('Timed out','TimeoutError');},async()=>new Response('not json'),async()=>new Response(null,{status:503})]) {
  const diagnostics=[];const service=new ProductLookupService([new OpenFactsProvider(failure),provider('fallback',async()=>product)],memory(),Date.now,e=>diagnostics.push(e));
  assert.deepEqual(await service.lookup(code),resolveProducts([product]));assert.equal(diagnostics[0].outcome,'error');assert.equal(diagnostics[1].outcome,'found');
 }
});
test('network deadline is passed to providers and cancellation does not start another provider',async()=>{
 let usedSignal;await new OpenFactsProvider(async(_,options)=>{usedSignal=options.signal;return new Response(null,{status:404});}).lookup(code);assert.ok(usedSignal instanceof AbortSignal);
 const controller=new AbortController();let fallbacks=0;
 const service=new ProductLookupService([provider('first',async()=>{controller.abort();throw new Error('cancelled');}),provider('next',async()=>{fallbacks++;return product;})],memory());
 await assert.rejects(()=>service.lookup(code,controller.signal));assert.equal(fallbacks,0);
});
test('fallback caches successes for equivalent codes; expiration refreshes; no-image product remains successful',async()=>{
 let now=1000,calls=0;const store=memory();const service=new ProductLookupService([provider('facts',async()=>null),provider('upc',async()=>{calls++;return product;})],store,()=>now);
 assert.deepEqual(await service.lookup('036000291452'),resolveProducts([product]));assert.deepEqual(await service.lookup('00036000291452'),resolveProducts([product]));assert.equal(calls,1);assert.equal(store.values.get(code).fetchedAt,1000);
 now+=8*86400000;await service.lookup(code);assert.equal(calls,2);
});
test('not-found requires all providers to respond; rate limits are retained across requests',async()=>{
 const store=memory();let paused=0;store.pause=async(_,until)=>{paused=until;};
 const service=new ProductLookupService([provider('facts',async()=>null),provider('upc',async()=>{throw new LookupError('rate limited',429,60);})],store,()=>1000);
 await assert.rejects(()=>service.lookup(code),e=>e.status===429);assert.equal(paused,61000);assert.equal(store.values.size,0);
 assert.equal(await new ProductLookupService([provider('facts',async()=>null),provider('upc',async()=>null)],memory()).lookup(code),null);
});
function sqliteStore(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0003_spotty_dexter_bennett.sql','utf8'));
 const adapt=sql=>({bind(...args){return {first:async()=>db.prepare(sql).get(...args)||null,run:async()=>db.prepare(sql).run(...args)};}});
 const store=new D1ProductStore({prepare:adapt,batch:async statements=>Promise.all(statements.map(s=>s.run()))});return {db,store};
}
test('D1 cache is shared across service instances and persisted quota prevents bursts/daily overuse',async()=>{
 const {db,store}=sqliteStore();const now=Date.parse('2026-09-25T12:00:00Z');
 await store.put({product:resolveProducts([product]),fetchedAt:now,expiresAt:now+86400000});assert.deepEqual((await store.get(code)).product,JSON.parse(JSON.stringify(resolveProducts([product]))));
 const cachedService=new ProductLookupService([provider('must not fetch',()=>{throw new Error('Unexpected fetch');})],store,()=>now);assert.deepEqual(await cachedService.lookup('036000291452'),JSON.parse(JSON.stringify(resolveProducts([product]))));
 assert.equal(await store.reserve('upcitemdb',now),0);assert.equal(await store.reserve('upcitemdb',now+100),11);assert.equal(await store.reserve('upcitemdb',now+11000),0);
 await store.pause('upcitemdb',now+120000);assert.equal(await store.reserve('upcitemdb',now+12000),108);
 db.prepare('UPDATE product_provider_budget SET requests=100,next_at=0 WHERE provider=?').run('upcitemdb');assert.equal(await store.reserve('upcitemdb',now),43200);assert.equal(await store.reserve('upcitemdb',now+86400000),0);
 db.close();
});
test('every lookup source and GTIN-14 round-trips through notes/backup/sync schema',()=>{
 const note={id:'n',title:'Product',barcode:'10012345000017',rating:null,categoryId:null,date:'2026-09-25',comment:'',price:null,currency:'EUR',photos:[],createdAt:'',updatedAt:''};
 for(const source of ['open-food-facts','open-beauty-facts','open-pet-food-facts','open-products-facts','upcitemdb','go-upc','open-fda'])assert.equal(noteSchema.parse({...note,productSource:source}).productSource,source);
});
