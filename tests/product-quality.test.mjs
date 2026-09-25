import test from 'node:test';
import {existingBarcodeNote} from '../lib/barcode.ts';
import assert from 'node:assert/strict';
import {resolveProducts,imageScore} from '../lib/product-resolution.ts';
import {normalizeFacts,normalizeGeneric} from '../lib/product-normalizers.ts';
import {safeProductImage,GoUPCProvider,OpenFDAProvider,LookupError} from '../lib/product-lookup.ts';
import {ProductLookupService} from '../lib/product-service.ts';
import {parseProductCode} from '../lib/gs1.ts';
import {relevantPrice} from '../lib/product-info.ts';
import {createBackup,parseBackup} from '../lib/backup.ts';
import {noteSchema} from '../lib/data-schema.ts';
import {imageDimensions,usableDimensions} from '../lib/product-image-quality.ts';
const barcode='6901668054715';
const product=(extra={})=>({barcode,name:'Original',source:'open-food-facts',...extra});
const image=(extra={})=>({url:'https://images.openfoodfacts.org/images/products/1/front_en.1.400.jpg',source:'open-food-facts',kind:'front',width:400,height:400,...extra});
function memory(){const values=new Map();return {values,get:async b=>values.get(b)||null,put:async v=>values.set(v.product.barcode,v),reserve:async()=>0,pause:async()=>{}};}
test('English title from another provider beats raw Chinese; source name remains separate',()=>{
 const found=resolveProducts([product({name:'mini奥利奥草莓味',brand:'Oreo'}),product({name:'OREO MINI STRAWBERRY',nameLanguage:'en',brand:'Oreo',source:'upcitemdb',quantity:'55g'})]);
 assert.equal(found.name,'Oreo Mini Strawberry 55 g');assert.equal(found.productInfo.originalName,'OREO MINI STRAWBERRY');assert.deepEqual(found.productInfo.sources,['open-food-facts','upcitemdb']);
});
test('best title is enriched with brand and quantity supplied by another exact-match provider',()=>{
 const found=resolveProducts([product({name:'mini奥利奥草莓味',brand:'Oreo',quantity:'55 g'}),product({name:'Mini Strawberry',nameLanguage:'en',source:'upcitemdb'})]);assert.equal(found.name,'Oreo Mini Strawberry 55 g');
});
test('explicit UI-language name outranks other-language and structured names',()=>{
 assert.equal(resolveProducts([product({name:'Chocolat',nameLanguage:'fr',brand:'Brand',localizedNames:{en:'Dark chocolate'},quantity:'100g'}),product({name:'Brand biscuits',nameLanguage:'en'})]).name,'Brand Dark Chocolate 100 g');
});
test('a brand-only localized row cannot beat another provider’s descriptive English name',()=>{
 const found=resolveProducts([product({name:'Jana',brand:'Jana',localizedNames:{en:'Jana'},productType:'Mineral water',structuredLanguage:'en',quantity:'1.5L'}),product({source:'upcitemdb',name:'Jana Still Water',brand:'Jana',nameLanguage:'en',quantity:'1.5L'})]);assert.equal(found.name,'Jana Still Water 1.5 L');
});
test('structured English brand, type, flavor enrich Chinese and brand-only titles without inventing attributes',()=>{
 assert.equal(resolveProducts([product({name:'mini奥利奥草莓味',brand:'OREO',productType:'Mini',flavor:'Strawberry',structuredLanguage:'en'})]).name,'Oreo Mini Strawberry');
 assert.equal(resolveProducts([product({name:'Jana',brand:'Jana',productType:'Still Water',quantity:'1,5L',structuredLanguage:'en'})]).name,'Jana Still Water 1.5 L');
 assert.equal(resolveProducts([product({name:'Jana',brand:'Jana'})]).name,'Jana');
 assert.equal(resolveProducts([product({name:'未知商品'})]).name,'未知商品');
});
test('brand casing is preserved, duplicated brands removed and ugly descriptor casing cleaned',()=>{
 for(const name of ['spar dark chocolate biscuits','SPAR SPAR DARK CHOCOLATE BISCUITS'])assert.equal(resolveProducts([product({name,brand:'spar',nameLanguage:'en'})]).name,'SPAR Dark Chocolate Biscuits');
 assert.equal(resolveProducts([product({name:'e.l.f. SKIN CREAM',brand:'e.l.f.',nameLanguage:'en'})]).name,'e.l.f. Skin Cream');
});
test('real Oreo and Jana source fields select useful English names and package size',()=>{
 // Public Open Facts records checked 2026-09-25; only the fields used by this regression are retained.
 const oreo=normalizeFacts({product_name:'mini奥利奥草莓味',product_name_en:'mini OREO Strawberry Flavor',brands:'Mondelēz, Oreo',quantity:'55 g',lang:'zh',product_type:'food'},barcode,'open-food-facts',safeProductImage);
 const found=resolveProducts([oreo]);assert.equal(found.name,'Oreo Mini Strawberry Flavor 55 g');assert.equal(found.productInfo.originalName,'mini奥利奥草莓味');assert.equal(found.categorySuggestion,'Food');
 const jana=normalizeFacts({product_name:'Natural mineral water non carbonated',brands:'Jana',quantity:'1,5L',lang:'hu',categories_tags:['en:waters','en:mineral-waters']},'3856028500285','open-food-facts',safeProductImage);
 assert.equal(resolveProducts([jana]).name,'Jana Mineral Water 1.5 L');
});
test('image selection combines providers, rejects labels/crops/thumbnails, scores role and size',()=>{
 const small=image({width:60,height:80});const full=image({url:'https://images.openfoodfacts.org/images/products/1/front_en.1.full.jpg',width:1600,height:2000});
 const label=image({kind:'nutrition',width:3000,height:4000});const cropped=image({cropFraction:.08});const other=image({url:'https://images.openfoodfacts.org/images/products/1/product.jpg',kind:'product',width:3000,height:3000});
 const found=resolveProducts([product({images:[small,label,cropped,other]}),product({source:'upcitemdb',images:[full]})]);assert.equal(found.imageUrl,full.url);assert.equal(found.images.length,2);assert.ok(imageScore(full)>imageScore(image()));
 assert.equal(resolveProducts([product({images:[small,label,cropped]})]).imageUrl,undefined);
 assert.equal(imageScore(image({url:'not a URL'})),-Infinity);
 assert.equal(imageScore(image({url:'https://example.com/nutrition_en.jpg',kind:'product'})),-Infinity);
});
test('Open Facts selected front metadata chooses full resolution and keeps ingredient information out of title',()=>{
 const found=resolveProducts([normalizeFacts({product_name:'Cream',lang:'en',product_type:'beauty',ingredients_text:'Aqua, Glycerin',selected_images:{front:{display:{en:image().url}},ingredients:{display:{en:'https://images.openfoodfacts.org/images/products/1/ingredients_en.1.400.jpg'}}},images:{front_en:{sizes:{full:{w:1200,h:1500},400:{w:320,h:400}}}}},barcode,'open-beauty-facts',safeProductImage)]);
 assert.match(found.imageUrl,/\.full\.jpg$/);assert.equal(found.categorySuggestion,'Beauty');assert.equal(found.productInfo.ingredients,'Aqua, Glycerin');assert.equal(found.name,'Cream');
 assert.equal(resolveProducts([normalizeFacts({product_name:'Cream',product_type:'beauty'},barcode,'open-food-facts',safeProductImage)]).categorySuggestion,'Beauty');
});
test('household/pet products remain useful without food-category suggestions or images',()=>{
 for(const [category,kind] of [['Household','product'],['Pet food','petfood']]){const found=resolveProducts([normalizeGeneric({title:'Useful product',category},barcode,'upcitemdb',safeProductImage)]);assert.equal(found.kind,kind);assert.equal(found.categorySuggestion,undefined);assert.equal(found.imageUrl,undefined);}
});
test('aggregation queries successful later sources, retains success on 429, refreshes old caches',async()=>{
 const store=memory();store.values.set(barcode,{product:product({name:'Stale'}),expiresAt:Infinity});let calls=0;
 const providers=[{id:'first',lookup:async()=>{calls++;return product({name:'mini奥利奥草莓味'});}},{id:'second',lookup:async()=>{calls++;return product({name:'Oreo Mini Strawberry',nameLanguage:'en',source:'upcitemdb'});}},{id:'third',lookup:async()=>{calls++;throw new LookupError('busy',429,60);}}];
 const service=new ProductLookupService(providers,store,()=>1000);assert.equal((await service.lookup(barcode)).name,'Oreo Mini Strawberry');assert.equal(calls,3);assert.equal(store.values.get(barcode).expiresAt,901000);
 await service.lookup(barcode);assert.equal(calls,3);
});
test('GS1 parses GTIN, lot, date, discards serial, and rejects invalid dates/check digits',()=>{
 const expected={barcode,barcodeType:'GS1 DataMatrix',batchNumber:'LOT42',expiryDate:'2027-10-31'};
 assert.deepEqual(parseProductCode(`]d2010${barcode}1727103110LOT42\x1d21SERIAL`),expected);
 assert.deepEqual(parseProductCode(`(01)0${barcode}(17)271031(10)LOT42(21)SERIAL`),expected);
 assert.equal(parseProductCode(`(01)0${barcode}(17)270200`).expiryDate,'2027-02');
 assert.equal(parseProductCode(`(01)0${barcode}(17)270231`),null);assert.equal(parseProductCode('(01)06901668054716'),null);
 assert.equal(parseProductCode(barcode).batchNumber,undefined);assert.equal(parseProductCode(barcode,'auto').barcodeType,'EAN-13 / UPC');
});
test('exact NDC package identifies medicine; ambiguous matches and unsupported GTINs do not',async()=>{
 const ndc='1234-5678-90',body='031234567890';let sum=0;for(let i=0;i<body.length;i++)sum+=Number(body[i])*(i%2?3:1);const gtin=body+(10-sum%10)%10;
 const row={brand_name:'Example',generic_name:'Ingredient',dosage_form:'TABLET',active_ingredients:[{name:'Ingredient',strength:'10 mg/1'}],packaging:[{package_ndc:ndc,description:'10 tablets'}]};
 let url;const provider=new OpenFDAProvider(async u=>{url=u;return Response.json({results:[row]});});const found=await provider.lookup(gtin);assert.equal(found.kind,'medicine');assert.equal(found.info.strength,'10 mg/1');assert.match(decodeURIComponent(url),/1234-5678-90/);assert.equal(await provider.lookup(barcode),null);
 assert.equal(await new OpenFDAProvider(async()=>Response.json({results:[row,row]})).lookup(gtin),null);
 assert.equal(resolveProducts([found,product({barcode:gtin,name:'Unrelated catalog title',nameLanguage:'en'})]).source,'open-fda');
});
test('Go-UPC normalizes exact results; keys stay in request headers and inferred matches are rejected',async()=>{
 let request;const provider=new GoUPCProvider('test-key',async(url,options)=>{request={url,options};return Response.json({code:barcode,product:{name:'Oreo Mini',brand:'Oreo',category:'Food',specs:[['Size','55 g']],ingredients:{text:'Wheat'}}});});
 const found=await provider.lookup(barcode);assert.equal(found.quantity,'55 g');assert.equal(found.info.ingredients,'Wheat');assert.equal(request.options.headers.Authorization,'Bearer test-key');assert.ok(!request.url.includes('test-key'));assert.equal(request.options.redirect,'manual');
 await assert.rejects(()=>new GoUPCProvider('key',async()=>Response.json({code:barcode,inferred:true})).lookup(barcode),/inferred/);
});
test('price suggestions require recent same-currency observations and known market when supplied',()=>{
 const now=Date.now(),base={amount:2.49,currency:'EUR',source:'Merchant',observedAt:now-1000,country:'HR'};
 assert.equal(relevantPrice([base],'EUR',now,'HR'),base);
 for(const price of [{...base,currency:'USD'},{...base,observedAt:now-15*86400000},{...base,observedAt:now+1},{...base,amount:0},{...base,country:'US'}])assert.equal(relevantPrice([price],'EUR',now,'HR'),undefined);
});
test('optional product info survives backup round trips without altering a personal comment',async()=>{
 const note={id:'n',title:'My review',comment:'My own thoughts',rating:null,categoryId:null,date:'2026-09-25',price:null,currency:'EUR',photos:[],createdAt:'',updatedAt:''};
 assert.equal(noteSchema.parse(note).productInfo,undefined);
 const info={...resolveProducts([product({info:{ingredients:'Wheat',allergens:'gluten'}})]).productInfo,batchNumber:'LOT42',expiryDate:'2027-10'};
 const parsed=noteSchema.parse(JSON.parse(JSON.stringify({...note,productInfo:info})));assert.deepEqual(parsed.productInfo,JSON.parse(JSON.stringify(info)));assert.equal(parsed.comment,note.comment);
 const backup=await createBackup({notes:[parsed],categories:[],preferences:{theme:'system',defaultCurrency:'EUR'}},new Map());assert.deepEqual((await parseBackup(backup)).data.notes[0],parsed);
});
test('image dimensions are checked before importing and malformed/tiny images are rejected',()=>{
 const png=new Uint8Array(24),v=new DataView(png.buffer);v.setUint32(0,0x89504e47);v.setUint32(16,1200);v.setUint32(20,1600);
 assert.deepEqual(imageDimensions(png),{width:1200,height:1600});assert.equal(usableDimensions(imageDimensions(png)),true);assert.equal(imageDimensions(new Uint8Array([1,2,3])),null);
 for(const dimensions of [{width:40,height:60},{width:8000,height:8000},{width:100,height:3000}])assert.equal(usableDimensions(dimensions),false);
});

test('existing barcode opens newest equivalent GTIN only, without changing or merging notes',()=>{
 const notes=[{id:'older',barcode:'0036000291452',updatedAt:'2026-09-01T10:00:00Z'},{id:'newer',barcode:'00036000291452',updatedAt:'2026-09-25T10:00:00Z'},{id:'different',barcode:'6901668054715',updatedAt:'2026-09-26T10:00:00Z'}];
 assert.equal(existingBarcodeNote(notes,'036000291452').id,'newer');assert.equal(existingBarcodeNote(notes,'96385074'),undefined);assert.equal(existingBarcodeNote(notes,'invalid'),undefined);assert.deepEqual(notes.map(n=>n.id),['older','newer','different']);
});
