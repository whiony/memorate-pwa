import {boundary,identity,database,bytes,json,ApiError} from '@/lib/server/api';
import {idSchema} from '@/lib/data-schema';
import {newShareToken,publicProjection} from '@/lib/public-note';
import {sharedPhotoKey} from '@/lib/server/shares';
import {z} from 'zod';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export const GET=(request:Request,context:Context)=>boundary(async()=>{const {userId}=await identity(request),id=idSchema.parse((await context.params).id),{db}=database();const row=await db.prepare('SELECT token FROM shared_notes WHERE owner_id = ? AND note_id = ?').bind(userId,id).first();return json({token:row?.token||null});});
export const POST=(request:Request,context:Context)=>boundary(async()=>{
 const {userId}=await identity(request),id=idSchema.parse((await context.params).id),{db,bucket}=database();
 const {updatedAt}=z.object({updatedAt:z.string().datetime()}).strict().parse(JSON.parse(new TextDecoder().decode(await bytes(request,1024))));
 const existing=await db.prepare('SELECT token FROM shared_notes WHERE owner_id = ? AND note_id = ?').bind(userId,id).first();if(existing)return json({token:existing.token});
 const rows=await db.batch<Record<string,unknown>>([
 db.prepare('SELECT n.title,n.comment,n.rating,n.note_date AS date,n.price,n.currency,n.updated_at AS updatedAt,c.name AS category,c.color AS categoryColor FROM notes n LEFT JOIN categories c ON n.owner_id=c.owner_id AND n.category_id=c.id WHERE n.owner_id=? AND n.id=?').bind(userId,id),
 db.prepare('SELECT storage_key FROM photos WHERE owner_id=? AND note_id=? ORDER BY sort_order').bind(userId,id)]);
 const note=rows[0].results[0];if(!note)throw new ApiError(404,'Synchronize this note before sharing it.');if(note.updatedAt!==updatedAt)throw new ApiError(409,'This note changed. Reopen it and try again.');
 const publicNote=publicProjection(note as unknown as Parameters<typeof publicProjection>[0],typeof note.category==='string'?{name:note.category,color:String(note.categoryColor)}:undefined,rows[1].results.length);
 const token=newShareToken(),keys:string[]=[];
 try {
  for(const [index,photo] of rows[1].results.entries()){const object=await bucket.get(String(photo.storage_key));if(!object)throw new ApiError(503,'A photo is unavailable. Retry sharing later.');const key=sharedPhotoKey(token,index);keys.push(key);await bucket.put(key,object.body,{httpMetadata:{contentType:'image/jpeg'}});}
  // Check the source again after asynchronous copying; never publish a deleted/stale note.
  const result=await db.prepare('INSERT INTO shared_notes (token,owner_id,note_id,public_json,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM notes WHERE owner_id=? AND id=? AND updated_at=?)').bind(token,userId,id,JSON.stringify(publicNote),new Date().toISOString(),userId,id,updatedAt).run();
  if(result.meta.changes!==1)throw new ApiError(409,'This note changed. Reopen it and try again.');
 }catch(error){if(keys.length)await bucket.delete(keys);throw error;}
 return json({token},201);
});
export const DELETE=(request:Request,context:Context)=>boundary(async()=>{const {userId}=await identity(request),id=idSchema.parse((await context.params).id),{db,bucket}=database();const row=await db.prepare('DELETE FROM shared_notes WHERE owner_id=? AND note_id=? RETURNING token').bind(userId,id).first<{token:string}>();if(row)await bucket.delete(Array.from({length:12},(_,i)=>sharedPhotoKey(row.token,i)));return json({revoked:true});});
