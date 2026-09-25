import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBarcode } from '../lib/barcode.ts';
import { OpenFoodFactsProvider, safeProductImage, downloadProductImage } from '../lib/product-lookup.ts';
import { noteSchema } from '../lib/data-schema.ts';
import { readFileSync } from 'node:fs';
test('EAN and UPC check digits, UPC-E expansion and identity normalization',()=>{
 assert.equal(normalizeBarcode('3017620422003'),'3017620422003');assert.equal(normalizeBarcode('96385074'),'96385074');assert.equal(normalizeBarcode('036000291452'),'0036000291452');assert.equal(normalizeBarcode('04252614','UPC_E'),'0042100005264');assert.equal(normalizeBarcode(' 3017-620422003 '),'3017620422003');
 for(const value of ['3017620422004','00000000','hello','123','30176204220031'])assert.equal(normalizeBarcode(value),null);
});
test('provider returns bounded product data and never trusts arbitrary image URLs',async()=>{
 let url,options;const provider=new OpenFoodFactsProvider(async(u,o)=>{url=u;options=o;return Response.json({status:1,product:{product_name:'  Product name  ',image_front_url:'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.1.400.jpg'}});});
 const product=await provider.lookup('3017620422003');assert.equal(product.name,'Product name');assert.equal(product.source,'open-food-facts');assert.match(url,/api\/v3\/product\/3017620422003/);assert.match(options.headers['User-Agent'],/Memorate/);assert.equal(options.redirect,'manual');assert.ok(product.imageUrl);
 for(const value of ['http://images.openfoodfacts.org/images/products/a.jpg','https://evil.test/a.jpg','https://images.openfoodfacts.org.evil.test/a.jpg','https://images.openfoodfacts.org:443@evil.test/a.jpg','https://images.openfoodfacts.org/images/products/a.svg'])assert.equal(safeProductImage(value),undefined);
});
test('provider unknown, invalid and unavailable results remain distinguishable',async()=>{
 assert.equal(await new OpenFoodFactsProvider(async()=>Response.json({status:0})).lookup('96385074'),null);
 await assert.rejects(()=>new OpenFoodFactsProvider(async()=>new Response('',{status:503})).lookup('96385074'));
 await assert.rejects(()=>new OpenFoodFactsProvider(()=>{throw new Error('Must not fetch');}).lookup('bad'),/Invalid retail/);
});
test('product image download rejects unsafe hosts, redirects, MIME, signatures and oversized responses',async()=>{
 const url='https://images.openfoodfacts.org/images/products/1/front.400.jpg';
 const image=await downloadProductImage(url,async(_,options)=>{assert.equal(options.redirect,'manual');return new Response(new Uint8Array([255,216,255,1]),{headers:{'content-type':'image/jpeg'}});});assert.equal(image.length,4);
 for(const response of [new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}}),new Response('html',{headers:{'content-type':'image/jpeg'}}),new Response('big',{headers:{'content-type':'image/jpeg','content-length':'6000000'}}),new Response(null,{status:302})])await assert.rejects(()=>downloadProductImage(url,async()=>response));
 await assert.rejects(()=>downloadProductImage('https://127.0.0.1/a.jpg'),/Unsupported/);
});
test('optional barcode metadata is backwards compatible and survives schema validation',()=>{
 const note={id:'n',title:'Manual note',rating:null,categoryId:null,date:'2026-09-25',comment:'',price:null,currency:'EUR',photos:[],createdAt:'',updatedAt:''};assert.equal(noteSchema.parse(note).barcode,undefined);assert.equal(noteSchema.parse({...note,barcode:'3017620422003',productSource:'open-food-facts'}).barcode,'3017620422003');
});
test('manifest and Apple icons are real PNGs at declared sizes; maskable assets are separate',()=>{
 const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));for(const icon of manifest.icons){const png=readFileSync(`public${icon.src}`);assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);}
 const apple=readFileSync('public/apple-touch-icon.png');assert.equal(apple.readUInt32BE(16),180);assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));assert.match(readFileSync('public/favicon.svg','utf8'),/#d96558/);
});
