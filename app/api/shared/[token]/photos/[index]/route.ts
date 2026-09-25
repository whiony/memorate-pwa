import {boundary,database,ApiError} from '@/lib/server/api';
import {readPublicNote,sharedPhotoKey,publicHeaders} from '@/lib/server/shares';
export const dynamic='force-dynamic';
export const GET=(_request:Request,{params}:{params:Promise<{token:string;index:string}>})=>boundary(async()=>{const {token,index}=await params,note=await readPublicNote(token);if(!/^(?:[0-9]|1[01])$/.test(index)||Number(index)>=note.photoCount)throw new ApiError(404,'Photo unavailable.');const {bucket}=database(),photo=await bucket.get(sharedPhotoKey(token,Number(index)));if(!photo)throw new ApiError(404,'Photo unavailable.');return new Response(photo.body,{headers:{...publicHeaders,'Content-Type':'image/jpeg'}});});
