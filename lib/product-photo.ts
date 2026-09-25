import { usableDimensions } from './product-image-quality';
import { newId } from './id';
import type { Photo } from './models';
/** Convert a bounded, validated provider image into the same local JPEG as uploads. */
export async function productPhoto(barcode:string,signal:AbortSignal):Promise<Photo> {
 const response=await fetch(`/api/products/${barcode}/image?v=3`,{signal});
 if(!response.ok)throw new Error('Photo unavailable');
 const blob=await response.blob();if(blob.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(blob.type))throw new Error('Invalid photo');
 const bitmap=await createImageBitmap(blob);
 try {if(!usableDimensions(bitmap))throw new Error('Image quality is insufficient');const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo unavailable');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const jpeg=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Photo unavailable')),'image/jpeg',.88));return {id:newId(),blob:jpeg,width:canvas.width,height:canvas.height};}finally{bitmap.close();}
}
