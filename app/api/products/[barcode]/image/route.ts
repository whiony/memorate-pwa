import { normalizeBarcode } from '@/lib/barcode';
import { productProvider, downloadProductImage } from '@/lib/product-lookup';
export async function GET(request:Request,{params}:{params:Promise<{barcode:string}>}) {
 const barcode=normalizeBarcode((await params).barcode);if(!barcode)return new Response(null,{status:400});
 try {const product=await productProvider.lookup(barcode,request.signal);if(!product?.imageUrl)return new Response(null,{status:404});const bytes=await downloadProductImage(product.imageUrl);return new Response(bytes,{headers:{'Content-Type':bytes[0]===255?'image/jpeg':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});}
 catch {return new Response(null,{status:502});}
}
