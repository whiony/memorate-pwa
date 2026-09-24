import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../app/chatgpt-auth";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function identity(request: Request) {
  if (request.method !== "GET" && (request.headers.get("Origin") !== new URL(request.url).origin || request.headers.get("Sec-Fetch-Site") === "cross-site")) throw new ApiError(403,"Request origin is not allowed.");
  const user = await getChatGPTUser(); if (!user) throw new ApiError(401,"Sign in to synchronize your collection."); return user;
}
export function database() { if (!env.DB || !env.BUCKET) throw new ApiError(503,"Cloud storage is not available yet. Your notes remain on this device."); return { db:env.DB, bucket:env.BUCKET }; }
export async function bytes(request: Request, limit: number) {
  if (Number(request.headers.get("Content-Length")) > limit) throw new ApiError(413,"Upload is too large.");
  const reader = request.body?.getReader(); if (!reader) throw new ApiError(400,"Missing request body."); const chunks:Uint8Array[]=[]; let size=0;
  for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>limit){await reader.cancel();throw new ApiError(413,"Upload is too large.");} chunks.push(value); }
  const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
export function json(data:unknown,status=200) { return Response.json(data,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}}); }
export async function boundary(work:()=>Promise<Response>) { try{return await work();}catch(error){ if(error instanceof ApiError)return json({error:error.message},error.status); if(error instanceof SyntaxError || (error instanceof Error && error.name==="ZodError"))return json({error:"Invalid data. Your local collection has not been removed."},400); console.error("Memorate storage request failed",error instanceof Error ? error.message : "unknown");return json({error:"Cloud operation failed. Your local notes are safe; retry later."},503); } }
export async function photoKey(owner:string,id:string) { const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(owner));return `photos/${Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("")}/${id}.jpg`; }
