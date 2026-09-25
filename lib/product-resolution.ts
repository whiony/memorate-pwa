import type { ProductInfo, PriceObservation } from './product-info.ts';
export type ImageCandidate={url:string;source:string;kind:'front'|'package'|'product'|'ingredients'|'nutrition'|'barcode'|'other';width?:number;height?:number;cropFraction?:number;language?:string};
export type Product={barcode:string;name:string;source:string;brand?:string;category?:string;imageUrl?:string;imageUrls?:string[];
 originalName?:string;nameLanguage?:string;localizedNames?:Record<string,string>;structuredLanguage?:string;productType?:string;variant?:string;flavor?:string;quantity?:string;
 kind?:'food'|'beauty'|'petfood'|'product'|'medicine';images?:ImageCandidate[];info?:Partial<ProductInfo>;prices?:PriceObservation[];
 productInfo?:ProductInfo;resolutionVersion?:number;categorySuggestion?:'Food'|'Beauty';};
const key=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu,'');
const BRAND_CASE:Record<string,string>={spar:'SPAR',oreo:'Oreo',jana:'Jana'};
export function brandName(value:string|undefined):string|undefined {const b=value?.split(',')[0]?.trim();return b ? BRAND_CASE[key(b)]||b : undefined;}
function words(value:string):string {
 return value.replace(/\s+/g,' ').trim().replace(/[A-Za-z]+/g,word=>{
  if(/^(ml|mg|mcg|kg|g)$/i.test(word))return word.toLowerCase();
  return word===word.toUpperCase()||word===word.toLowerCase()?word[0].toUpperCase()+word.slice(1).toLowerCase():word;
 });
}
function withoutBrand(value:string,brand:string|undefined) {
 if(!brand)return value;
 const escaped=brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return value.replace(new RegExp(`(^|[\\s,;:])${escaped}(?=$|[\\s,;:])`,'gi'),' ').replace(/\s+/g,' ').trim();
}
function quantity(value:string|undefined) {return value?.replace(/(\d),(\d)/g,'$1.$2').replace(/(\d)\s*(ml|cl|l|kg|g)\b/gi,(_,n,u)=>`${n} ${u.toLowerCase()==='l'?'L':u.toLowerCase()}`);}
function join(parts:(string|undefined)[]) {
 let result='';for(const raw of parts){const part=raw?.trim();if(part&&!key(result).includes(key(part)))result+=`${result?' ':''}${part}`;}return result.slice(0,160);
}
function title(p:Product,language:string) {
 const brand=brandName(p.brand),localized=p.localizedNames?.[language];
 const structured=p.structuredLanguage===language;
 const raw=localized||p.name;
 const onlyBrand=!!brand&&key(raw)===key(brand);
 const usableStructured=structured&&!!(p.productType||p.variant||p.flavor);
 const rawPreferred=!!localized||p.nameLanguage===language;
 const useStructured=usableStructured&&(!rawPreferred||onlyBrand);
 const descriptor=useStructured?join([p.productType,p.variant,p.flavor]):raw;
 const name=join([brand,words(withoutBrand(descriptor,brand)),useStructured?undefined:(onlyBrand&&structured?words(p.productType||''):undefined),quantity(p.quantity)]);
 // Keep language tiers far enough apart that length cannot promote a weaker name.
 let score=(!onlyBrand&&localized?400:!onlyBrand&&rawPreferred?300:useStructured?200:onlyBrand?0:100)+Math.min(20,name.split(/\s+/).length*3);
 if(brand&&key(name)===key(brand))score-=70;
 if(!/[A-Za-z]/.test(name)&&language==='en')score-=20;
 return {name,score,product:p};
}
export function imageScore(image:ImageCandidate,language='en'):number {
 let path:string;try{path=new URL(image.url).pathname;}catch{return -Infinity;}
 if(['ingredients','nutrition','barcode'].includes(image.kind)||/(?:ingredients|nutrition|barcode)[_.\/-]/i.test(path))return -Infinity;
 if(image.cropFraction!==undefined&&image.cropFraction<.18)return -Infinity;
 if(image.width&&image.height&&(Math.min(image.width,image.height)<80||Math.max(image.width,image.height)<300||Math.max(image.width,image.height)/Math.min(image.width,image.height)>7))return -Infinity;
 const area=(image.width||0)*(image.height||0);
 return ({front:100,package:80,product:40,other:0,ingredients:-999,nutrition:-999,barcode:-999}[image.kind])+Math.min(35,area/25000)+(image.language===language?4:0)-(image.cropFraction!==undefined&&image.cropFraction<.4?35:0);
}
export function resolveProducts(products:Product[],language='en'):Product|null {
 if(!products.length)return null;
 const barcode=products[0].barcode;
 const matches=products.filter(p=>p.barcode===barcode);
 const medicine=matches.filter(p=>p.kind==='medicine');
 const ranked=(medicine.length?medicine:matches).map(p=>title(p,language)).sort((a,b)=>b.score-a.score);
 const winner=ranked[0];if(!winner?.name)return null;
 const best=winner.product,ordered=[best,...matches.filter(p=>p!==best)];
 const info:Partial<ProductInfo>={};
 for(const p of [...ordered].reverse())for(const [k,v] of Object.entries(p.info||{}))if(v!==undefined&&v!==''&&(!Array.isArray(v)||v.length))Object.assign(info,{[k]:v});
 const imageCandidates=matches.flatMap(p=>p.images||[...(p.imageUrl?[p.imageUrl]:[]),...(p.imageUrls||[])].map(url=>({url,source:p.source,kind:'product' as const})));
 const seen=new Set<string>();const images=imageCandidates.filter(i=>Number.isFinite(imageScore(i,language))).sort((a,b)=>imageScore(b,language)-imageScore(a,language)).filter(i=>{if(seen.has(i.url))return false;seen.add(i.url);return true;});
 const pick=(field:'brand'|'productType'|'variant'|'flavor'|'quantity')=>ordered.find(p=>p[field])?.[field];
 const kind=medicine.length?'medicine':best.kind||matches.find(p=>p.kind)?.kind;
 const displayName=title({...best,brand:pick('brand'),quantity:pick('quantity')},language).name;
 const productInfo:ProductInfo={...info,barcode,originalName:best.originalName||best.name,displayName,brand:brandName(pick('brand')),productType:pick('productType')||info.productType,variant:pick('variant'),flavor:pick('flavor'),quantity:quantity(pick('quantity')),sources:[...new Set(matches.map(p=>p.source))]};
 return {...best,name:displayName,productInfo,resolutionVersion:3,images,imageUrl:images[0]?.url,imageUrls:images.slice(0,5).map(i=>i.url),prices:matches.flatMap(p=>p.prices||[]),categorySuggestion:kind==='food'?'Food':kind==='beauty'?'Beauty':undefined};
}
