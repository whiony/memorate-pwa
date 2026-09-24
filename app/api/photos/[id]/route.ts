import { boundary, identity, database, bytes, photoKey, ApiError, json } from "@/lib/server/api";
import { idSchema } from "@/lib/data-schema";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{id:string}> };
export const PUT = (request:Request, context:Context) => boundary(async()=>{
  const user=await identity(request),id=idSchema.parse((await context.params).id),{bucket}=database();
  if(request.headers.get("Content-Type")!=="image/jpeg")throw new ApiError(415,"Only compressed JPEG photos are accepted.");
  const data=await bytes(request,8*1024*1024);if(data[0]!==255||data[1]!==216||data[2]!==255||data.length<4)throw new ApiError(400,"Invalid JPEG photo.");
  const key=await photoKey(user.userId,id);
  // Photo IDs are immutable. Repeated uploads safely return the existing object.
  if(!(await bucket.head(key)))await bucket.put(key,data,{httpMetadata:{contentType:"image/jpeg"}});
  return json({id});
});
export const GET = (request:Request, context:Context) => boundary(async()=>{
  const user=await identity(request),id=idSchema.parse((await context.params).id),{bucket,db}=database();
  const metadata=await db.prepare("SELECT id FROM photos WHERE owner_id = ? AND id = ? LIMIT 1").bind(user.userId,id).first();
  if(!metadata)throw new ApiError(404,"Photo not found.");
  const object=await bucket.get(await photoKey(user.userId,id));if(!object)throw new ApiError(404,"Photo not found.");
  return new Response(object.body,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
});
