import { boundary, identity, database, bytes, photoKey, ApiError, json } from "@/lib/server/api";
import { idSchema } from "@/lib/data-schema";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{id:string}> };
export const PUT = (request:Request, context:Context) => boundary(async()=>{
  const user=await identity(request),id=idSchema.parse((await context.params).id),{bucket,db}=database();
  if(request.headers.get("Content-Type")!=="image/jpeg")throw new ApiError(415,"Only compressed JPEG photos are accepted.");
  const data=await bytes(request,8*1024*1024);if(data[0]!==255||data[1]!==216||data[2]!==255||data.length<4)throw new ApiError(400,"Invalid JPEG photo.");
  const key=await photoKey(user.userId,id);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",data)),b=>b.toString(16).padStart(2,"0")).join("");
  const old=await bucket.head(key);
  if(old && old.customMetadata?.sha256!==digest)throw new ApiError(409,"Photo ID already names different content. Import a backup to remap it safely.");
  if(!old){const stored=await bucket.put(key,data,{onlyIf:{etagDoesNotMatch:"*"},httpMetadata:{contentType:"image/jpeg"},customMetadata:{sha256:digest}});if(!stored && (await bucket.head(key))?.customMetadata?.sha256!==digest)throw new ApiError(409,"Photo ID already names different content. Import a backup to remap it safely.");}
  await db.prepare("INSERT INTO photo_objects (owner_id,id,storage_key,sha256,size,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING").bind(user.userId,id,key,digest,data.length,new Date().toISOString()).run();
  return json({id});
});
export const GET = (request:Request, context:Context) => boundary(async()=>{
  const user=await identity(request),id=idSchema.parse((await context.params).id),{bucket,db}=database();
  const metadata=await db.prepare("SELECT id FROM photos WHERE owner_id = ? AND id = ? LIMIT 1").bind(user.userId,id).first();
  if(!metadata)throw new ApiError(404,"Photo not found.");
  const object=await bucket.get(await photoKey(user.userId,id));if(!object)throw new ApiError(404,"Photo not found.");
  return new Response(object.body,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
});
