import type { Product, ImageCandidate } from './product-resolution.ts';
import type { ProductInfo, PriceObservation } from './product-info.ts';
export const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export const clean=(v:unknown,max=300):string|undefined=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max)||undefined:undefined;
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
function tags(v:unknown,language='en'):string[] {return list(v).filter((s):s is string=>typeof s==='string'&&s.startsWith(`${language}:`)).map(s=>s.slice(language.length+1).replace(/-/g,' '));}
const categoryName=(value:string|undefined)=>value?({'mineral waters':'mineral water','spring waters':'spring water','waters':'water'} as Record<string,string>)[value]||value:undefined;
const size=(v:unknown)=>{const s=record(v);return {width:typeof s.w==='number'?s.w:undefined,height:typeof s.h==='number'?s.h:undefined};};
export function normalizeFacts(raw:unknown,barcode:string,source:string,safe:(v:unknown)=>string|undefined):Product|null {
 const p=record(raw),name=clean(p.product_name)||clean(p.product_name_en)||clean(p.generic_name_en)||clean(p.generic_name)||clean(p.brands);if(!name)return null;
 const categoryTags=tags(p.categories_tags);
 // Taxonomy labels carry explicit language, unlike arbitrary Latin-script product names.
 const productType=clean(p.generic_name_en)||categoryName(categoryTags.filter(c=>/^[a-z0-9 ,&()/-]+$/i.test(c)&&!/[éèàûœ]/i.test(c)).at(-1));
 const flavor=clean(p.flavor_en)||tags(p.flavors_tags).join(', ')||undefined;
 const variant=clean(p.variant_en);
 const info:Partial<ProductInfo>={ingredients:clean(p.ingredients_text_en,6000)||clean(p.ingredients_text,6000),allergens:tags(p.allergens_tags).join(', ')||undefined,sourceCountry:tags(p.countries_tags).join(', ').slice(0,300)||undefined};
 const n=record(p.nutriments);const nutrition:NonNullable<ProductInfo['nutrition']>=[];
 for(const [field,label,unit] of [['energy-kcal','Energy','kcal'],['fat','Fat','g'],['saturated-fat','Saturated fat','g'],['carbohydrates','Carbohydrates','g'],['sugars','Sugars','g'],['fiber','Fibre','g'],['proteins','Protein','g'],['salt','Salt','g']]) {
  const value=n[`${field}_100g`];if(typeof value==='number'&&Number.isFinite(value)&&value>=0)nutrition.push({name:`${label} / 100 g`,value:`${value} ${unit}`});
 }
 if(nutrition.length)info.nutrition=nutrition;
 const images:ImageCandidate[]=[];const selected=record(p.selected_images),metadata=record(p.images);
 for(const kind of ['front','ingredients','nutrition'] as const) {
  const display=record(record(selected[kind]).display);
  for(const [language,value] of Object.entries(display)) {
   const url=safe(value);if(!url)continue;
   const meta=record(metadata[`${kind}_${language}`]),sizes=record(meta.sizes),rawMeta=record(metadata[String(meta.imgid)]);
   const coordinates=String(meta.coordinates_image_size||'full');const base=size(record(rawMeta.sizes)[coordinates]);
   const crop=typeof meta.x1==='number'&&typeof meta.x2==='number'&&typeof meta.y1==='number'&&typeof meta.y2==='number'&&meta.x1>=0&&meta.y1>=0&&base.width&&base.height?(meta.x2-meta.x1)*(meta.y2-meta.y1)/(base.width*base.height):undefined;
   const full=size(sizes.full);
   // The documented full selected image keeps the selected role, not an arbitrary raw photo.
   if(full.width&&full.height&&full.width*full.height<=25000000){const fullUrl=safe(url.replace(/\.400\.(jpg|png)$/i,'.full.$1'));if(fullUrl)images.push({url:fullUrl,source,kind,language,...full,cropFraction:crop});}
   images.push({url,source,kind,language,...size(sizes['400']),cropFraction:crop});
  }
 }
 if(!images.some(i=>i.kind==='front')){const url=safe(p.image_front_url);if(url)images.push({url,source,kind:'front'});}
 const brands=clean(p.brands)?.split(',').map(b=>b.trim());
 const brand=brands?.find(b=>(clean(p.product_name_en)||name).toLowerCase().includes(b.toLowerCase()))||brands?.[0];
 const kind=p.product_type==='food'||p.product_type==='beauty'||p.product_type==='petfood'||p.product_type==='product'?p.product_type:source==='open-food-facts'?'food':source==='open-beauty-facts'?'beauty':source==='open-pet-food-facts'?'petfood':'product';
 return {barcode,name,originalName:name,source,brand,quantity:clean(p.quantity),category:clean(p.categories),productType,flavor,variant,kind,structuredLanguage:productType||flavor||variant?'en':undefined,nameLanguage:clean(p.lang),localizedNames:clean(p.product_name_en)?{en:clean(p.product_name_en)!}:undefined,images,imageUrl:images.find(i=>i.kind==='front')?.url,info};
}
export function normalizeGeneric(raw:unknown,barcode:string,source:string,safe:(v:unknown)=>string|undefined):Product|null {
 const p=record(raw),name=clean(p.title)||clean(p.name);if(!name)return null;
 const category=clean(p.category),imageUrls=list(p.images).map(safe).filter((v):v is string=>!!v).slice(0,8);
 const kind=category&&/pet|animal/i.test(category)?'petfood':category&&/food|beverage/i.test(category)?'food':category&&/cosmetic|skin care|beauty|personal care/i.test(category)?'beauty':'product';
 const prices:PriceObservation[]=list(p.offers).flatMap(raw=>{const o=record(raw),amount=typeof o.price==='number'?o.price:NaN,currency=clean(o.currency),source=clean(o.merchant),observedAt=typeof o.updated_t==='number'?o.updated_t*1000:0;
  return amount>0&&Number.isFinite(amount)&&currency&&/^[A-Z]{3}$/.test(currency)&&source&&observedAt&&(!o.availability||o.availability==='In Stock')?[{amount,currency,source,observedAt}]:[];
 });
 // UPCitemdb publishes English catalog titles, but never label non-Latin titles as English.
 const english=/[A-Za-z]/.test(name)&&!/[\p{Script=Han}\p{Script=Cyrillic}\p{Script=Arabic}]/u.test(name);
 return {barcode,name,originalName:name,source,brand:clean(p.brand),quantity:clean(p.size)||clean(p.weight),category,kind,nameLanguage:english?'en':undefined,imageUrl:imageUrls[0],imageUrls,images:imageUrls.map(url=>({url,source,kind:'product'})),prices};
}
