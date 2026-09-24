import { normalizeBarcode } from '@/lib/barcode';
import { productProvider } from '@/lib/product-lookup';
export async function GET(request:Request,{params}:{params:Promise<{barcode:string}>}) {
 const barcode=normalizeBarcode((await params).barcode);
 if(!barcode)return Response.json({error:'Enter a valid EAN or UPC barcode.'},{status:400});
 try {const product=await productProvider.lookup(barcode,request.signal);return Response.json({product:product?{barcode:product.barcode,name:product.name,source:product.source,hasImage:!!product.imageUrl}:null},{headers:{'Cache-Control':'public, max-age=300'}});}
 catch (error) {console.warn('Product lookup unavailable:',error instanceof Error ? error.message : 'Unknown failure');return Response.json({error:'Product search is unavailable. Try again or continue manually.'},{status:503});}
}
