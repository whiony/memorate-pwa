import { normalizeBarcode } from '@/lib/barcode';
import { productProvider } from '@/lib/server/products';
import { LookupError } from '@/lib/product-lookup';
export async function GET(request:Request,{params}:{params:Promise<{barcode:string}>}) {
 const barcode=normalizeBarcode((await params).barcode);
 if(!barcode)return Response.json({error:'Enter a valid EAN, UPC or GTIN barcode.'},{status:400});
 try {const product=await productProvider().lookup(barcode,request.signal);return Response.json({product:product?{barcode:product.barcode,name:product.name,brand:product.brand,category:product.category,source:product.source,hasImage:!!product.imageUrl}:null},{headers:{'Cache-Control':'public, max-age=300'}});}
 catch (error) {console.warn('Product lookup unavailable:',error instanceof Error ? error.message : 'Unknown failure');const limited=error instanceof LookupError && error.status===429; return Response.json({error:limited?'Product search is busy. Try again shortly or continue manually.':'Product search is unavailable. Try again or continue manually.'},{status:limited?429:503,headers:{'Cache-Control':'no-store',...(limited?{'Retry-After':String(error.retryAfter)}:{})}});}
}
