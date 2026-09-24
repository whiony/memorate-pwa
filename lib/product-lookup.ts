import { normalizeBarcode } from './barcode.ts';
export type Product = { barcode:string; name:string; source:string; imageUrl?:string };
export interface ProductLookupProvider { readonly id:string; lookup(barcode:string, signal?:AbortSignal):Promise<Product|null> }
const USER_AGENT='Memorate/1.3 (https://memorate.whiony.chatgpt.site)';
export function safeProductImage(value:unknown):string|undefined {
  if(typeof value!=='string')return;
  try { const url=new URL(value);if(url.protocol==='https:'&&url.hostname==='images.openfoodfacts.org'&&!url.port&&!url.username&&!url.password&&/^\/images\/products\/[\w/.-]+\.(jpg|jpeg|png)$/i.test(url.pathname)&&!url.search)return url.href; } catch { /* Untrusted provider URL. */ }
}
export async function limitedBody(response:Response,limit:number):Promise<Uint8Array<ArrayBuffer>> {
  if(Number(response.headers.get('content-length'))>limit)throw new Error('Product response is too large');
  const reader=response.body?.getReader();if(!reader)throw new Error('Empty product response');
  const parts:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Product response is too large');}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;
}
export class OpenFoodFactsProvider implements ProductLookupProvider {
  readonly id='open-food-facts';
  private readonly request:typeof fetch;
  constructor(request:typeof fetch=fetch) { this.request=request; }
  async lookup(input:string,signal?:AbortSignal):Promise<Product|null> {
    const barcode=normalizeBarcode(input);if(!barcode)throw new Error('Invalid retail barcode');
    const response=await this.request(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=code,product_name,product_name_en,image_front_url`,{headers:{'User-Agent':USER_AGENT,Accept:'application/json'},redirect:'manual',signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000)});
    if(response.status===404)return null;if(!response.ok)throw new Error('Product lookup is unavailable');
    const data=JSON.parse(new TextDecoder().decode(await limitedBody(response,256*1024)));
    if(data.status===0)return null;
    const name=data.product?.product_name||data.product?.product_name_en;
    if(typeof name!=='string'||!name.trim())return null;
    return {barcode,name:name.trim().slice(0,160),source:this.id,imageUrl:safeProductImage(data.product.image_front_url)};
  }
}
export const productProvider:ProductLookupProvider=new OpenFoodFactsProvider();
export async function downloadProductImage(url:string,request:typeof fetch=fetch):Promise<Uint8Array<ArrayBuffer>> {
  if(!safeProductImage(url))throw new Error('Unsupported product image host');
  const response=await request(url,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'User-Agent':USER_AGENT}});
  if(!response.ok||!/^image\/(jpeg|png)(;|$)/i.test(response.headers.get('content-type')||''))throw new Error('Invalid product image');
  const bytes=await limitedBody(response,5*1024*1024);
  if(!((bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)))throw new Error('Invalid image signature');
  return bytes;
}
