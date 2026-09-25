import { imageDimensions, usableDimensions } from '@/lib/product-image-quality';
import { normalizeBarcode } from '@/lib/barcode';
import { downloadProductImage, imageMime } from '@/lib/product-lookup';
import { productProvider } from '@/lib/server/products';
export async function GET(request:Request,{params}:{params:Promise<{barcode:string}>}) {
 const barcode=normalizeBarcode((await params).barcode);if(!barcode)return new Response(null,{status:400});
 try {
  const product=await productProvider().lookup(barcode,request.signal);if(!product?.imageUrl)return new Response(null,{status:404});
  for(const url of [...new Set([product.imageUrl,...(product.imageUrls||[])])].slice(0,3)) {
   if(request.signal.aborted)return new Response(null,{status:499});
   try {const bytes=await downloadProductImage(url);if(!usableDimensions(imageDimensions(bytes)))continue;return new Response(bytes,{headers:{'Content-Type':imageMime(bytes)!,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});}catch { /* A merchant image can expire; try another trusted provider image. */ }
  }
  return new Response(null,{status:502});
 } catch {return new Response(null,{status:502});}
}
