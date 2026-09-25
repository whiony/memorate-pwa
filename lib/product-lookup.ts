import { normalizeBarcode } from './barcode.ts';
import { normalizeFacts, normalizeGeneric, record, clean } from './product-normalizers.ts';
import type { Product } from './product-resolution.ts';
export type { Product } from './product-resolution.ts';
export interface ProductLookupProvider { readonly id: string; supports?(barcode:string):boolean; lookup(barcode: string, signal?: AbortSignal): Promise<Product | null> }
export class LookupError extends Error {
  status: number;
  retryAfter: number;
  constructor(message: string, status = 503, retryAfter = 0) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
const USER_AGENT = 'Memorate/1.4 (https://memorate.whiony.chatgpt.site)';
const FACTS = {
  'world.openfoodfacts.org': 'open-food-facts',
  'world.openbeautyfacts.org': 'open-beauty-facts',
  'world.openpetfoodfacts.org': 'open-pet-food-facts',
  'world.openproductsfacts.org': 'open-products-facts',
} as const;
const IMAGE_HOSTS = new Set([
  'images.openfoodfacts.org', 'images.openbeautyfacts.org', 'images.openpetfoodfacts.org', 'images.openproductsfacts.org',
  'i5.walmartimages.com', 'i.ebayimg.com', 'images-na.ssl-images-amazon.com', 'm.media-amazon.com',
  'go-upc.s3.amazonaws.com', 'images.upcitemdb.com', 'www.boscovs.com', 'target.scene7.com', 'scene7.samsclub.com', 'images.thdstatic.com',
]);
/** Restrict provider images to known public CDNs; never turn the Worker into an arbitrary URL proxy. */
export function safeProductImage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !IMAGE_HOSTS.has(url.hostname) || url.port || url.username || url.password) return;
    if (url.hostname.startsWith('images.open') && !/^\/images\/products\/[\w/.-]+\.(jpg|jpeg|png)$/i.test(url.pathname)) return;
    if (/\.(svg|html?)$/i.test(url.pathname)) return;
    return url.href;
  } catch { /* Ignore untrusted provider URL. */ }
}
export async function limitedBody(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(response.headers.get('content-length')) > limit) throw new Error('Product response is too large');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Empty product response');
  const parts: Uint8Array[] = []; let size = 0;
  for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new Error('Product response is too large'); } parts.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const p of parts) { bytes.set(p,offset); offset += p.length; } return bytes;
}
function timeout(signal?: AbortSignal) { const deadline = AbortSignal.timeout(8000); return signal ? AbortSignal.any([signal,deadline]) : deadline; }
export function retryAfter(response: Response, now = Date.now()): number {
  const value = response.headers.get('Retry-After');
  const reset = Number(response.headers.get('X-RateLimit-Reset')) * 1000;
  const delay = value ? (/^\d+$/.test(value) ? Number(value) : (Date.parse(value) - now) / 1000) : (reset - now) / 1000;
  return Math.max(10, Math.min(86400, Math.ceil(Number.isFinite(delay) && delay > 0 ? delay : 60)));
}
async function json(response: Response) {
  if (response.status === 404) return null;
  if (response.status === 429) throw new LookupError('Product search is busy. Try again shortly or continue manually.', 429, retryAfter(response));
  if (!response.ok) throw new LookupError(`Product provider HTTP ${response.status}`);
  return JSON.parse(new TextDecoder().decode(await limitedBody(response, 256 * 1024)));
}
export class OpenFactsProvider implements ProductLookupProvider {
  readonly id = 'open-facts';
  private request: typeof fetch;
  constructor(request: typeof fetch = fetch) { this.request = request; }
  async lookup(input: string, signal?: AbortSignal): Promise<Product | null> {
    const barcode = normalizeBarcode(input); if (!barcode) throw new Error('Invalid retail barcode');
    let url = new URL(`https://world.openfoodfacts.org/api/v3/product/${barcode}?product_type=all&lc=en&fields=code,product_name,product_name_en,generic_name,generic_name_en,lang,product_type,image_front_url,selected_images,images,brands,categories,categories_tags,quantity,flavor_en,flavors_tags,variant_en,ingredients_text,ingredients_text_en,allergens_tags,nutriments,countries_tags`);
    const deadline = timeout(signal);
    // The universal API redirects to the matching beauty/pet/general database.
    for (let hop = 0; hop < 4; hop++) {
      const response = await this.request(url.href, {headers:{'User-Agent':USER_AGENT,Accept:'application/json'},redirect:'manual',signal:deadline});
      if ([301,302,303,307,308].includes(response.status)) {
        const next = new URL(response.headers.get('Location') || '',url);
        if (next.protocol !== 'https:' || !(next.hostname in FACTS) || next.port || next.username || next.password || !([`/api/v3/product/${barcode}`,`/api/v3/product/${barcode}.json`].includes(next.pathname))) throw new LookupError('Invalid product provider redirect');
        url = next; continue;
      }
      const data = await json(response);
      if (!data || data.status === 0 || data.result?.id === 'product_not_found') return null;
      const p = data.product;
      if (!p || typeof p !== 'object') throw new LookupError('Invalid product provider response');
      if (p.code && normalizeBarcode(String(p.code)) !== barcode) throw new LookupError('Provider returned a different barcode');
      return normalizeFacts(p,barcode,FACTS[url.hostname as keyof typeof FACTS],safeProductImage);
    }
    throw new LookupError('Too many product provider redirects');
  }
}
// Kept for existing integrations; now searches all four Open Facts product types.
export { OpenFactsProvider as OpenFoodFactsProvider };
export class UPCItemDbProvider implements ProductLookupProvider {
  readonly id = 'upcitemdb';
  private request: typeof fetch;
  constructor(request: typeof fetch = fetch) { this.request = request; }
  async lookup(input: string, signal?: AbortSignal): Promise<Product | null> {
    const barcode = normalizeBarcode(input); if (!barcode) throw new Error('Invalid retail barcode');
    const data = await json(await this.request(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {headers:{Accept:'application/json','User-Agent':USER_AGENT},redirect:'manual',signal:timeout(signal)}));
    if (!data) return null;
    if (data.code !== 'OK' || !Array.isArray(data.items)) throw new LookupError('Invalid UPCitemdb response');
    const p = data.items.find((item: {ean?: string; upc?: string; gtin?: string}) => [item.ean,item.upc,item.gtin].some(code => code && normalizeBarcode(code) === barcode));
    return normalizeGeneric(p,barcode,this.id,safeProductImage);
  }
}
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'image/png';
  if (new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}
export async function downloadProductImage(url: string, request: typeof fetch = fetch): Promise<Uint8Array<ArrayBuffer>> {
  if (!safeProductImage(url)) throw new Error('Unsupported product image host');
  const response = await request(url, {redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'User-Agent':USER_AGENT}});
  if (!response.ok || !/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('Invalid product image');
  const bytes = await limitedBody(response,5 * 1024 * 1024);
  if (!imageMime(bytes)) throw new Error('Invalid image signature');
  return bytes;
}

/** Optional authenticated provider; never sends a key to the browser or follows redirects. */
export class GoUPCProvider implements ProductLookupProvider {
 readonly id='go-upc'; private key:string; private request:typeof fetch;
 constructor(key:string,request:typeof fetch=fetch){this.key=key;this.request=request;}
 async lookup(input:string,signal?:AbortSignal):Promise<Product|null>{
  const barcode=normalizeBarcode(input);if(!barcode)throw new Error('Invalid retail barcode');
  const data=await json(await this.request(`https://go-upc.com/api/v1/code/${barcode}`,{headers:{Authorization:`Bearer ${this.key}`,Accept:'application/json'},redirect:'manual',signal:timeout(signal)}));
  if(!data)return null;if(data.inferred||normalizeBarcode(String(data.code))!==barcode)throw new LookupError('Go-UPC returned an inferred or different barcode');
  const raw=record(data.product),specs=Object.fromEntries(Array.isArray(raw.specs)?raw.specs.filter((v:unknown)=>Array.isArray(v)&&v.length===2):[]);
  const p=normalizeGeneric({...raw,images:[raw.imageUrl],size:specs['Size']||specs['Package Size']},barcode,this.id,safeProductImage);
  if(p)p.info={ingredients:clean(record(raw.ingredients).text,6000)};
  return p;
 }
}
/** US NDC-embedded consumer GTIN only. Never infer a medicine from a similar name. */
export class OpenFDAProvider implements ProductLookupProvider {
 readonly id='open-fda'; private request:typeof fetch;
 constructor(request:typeof fetch=fetch){this.request=request;}
 supports(barcode:string){return /^03\d{11}$/.test(barcode);}
 async lookup(input:string,signal?:AbortSignal):Promise<Product|null>{
  const barcode=normalizeBarcode(input);if(!barcode)throw new Error('Invalid retail barcode');if(!this.supports(barcode))return null;
  const ndc=barcode.slice(2,-1);
  const variants=[`${ndc.slice(0,4)}-${ndc.slice(4,8)}-${ndc.slice(8)}`,`${ndc.slice(0,5)}-${ndc.slice(5,8)}-${ndc.slice(8)}`,`${ndc.slice(0,5)}-${ndc.slice(5,9)}-${ndc.slice(9)}`];
  const search=variants.map(v=>`packaging.package_ndc:"${v}"`).join(' OR ');
  const data=await json(await this.request(`https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(search)}&limit=10`,{headers:{'User-Agent':USER_AGENT,Accept:'application/json'},redirect:'manual',signal:timeout(signal)}));
  if(!data)return null;
  const matches=(Array.isArray(data.results)?data.results:[]).flatMap((value:unknown)=>{const row=record(value);return (Array.isArray(row.packaging)?row.packaging:[]).flatMap((value:unknown)=>{const pack=record(value);return typeof pack.package_ndc==='string'&&pack.package_ndc.replace(/-/g,'')===ndc?[{row,pack}]:[];});});
  if(matches.length!==1)return null; // Ambiguous segmentation must not identify a drug.
  const {row,pack}=matches[0],name=clean(row.brand_name)||clean(row.generic_name);if(!name)return null;
  const active=(Array.isArray(row.active_ingredients)?row.active_ingredients:[]).map(record);
  const strength=active.map((i:Record<string,unknown>)=>clean(i.strength)).filter(Boolean).join(', ').slice(0,300)||undefined;
  const form=clean(row.dosage_form),quantity=clean(pack.description);
  return {barcode,name,originalName:name,source:this.id,kind:'medicine',nameLanguage:'en',brand:clean(row.brand_name),productType:form,structuredLanguage:'en',variant:strength,quantity,info:{activeIngredient:active.map((i:Record<string,unknown>)=>clean(i.name)).filter(Boolean).join(', ').slice(0,300),strength,pharmaceuticalForm:form,sourceCountry:'United States'}};
 }
}
