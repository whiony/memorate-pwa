import { z } from "zod";
import { alignDefaultCategories } from "@/lib/category-normalization";
import { snapshotSchema, type Snapshot } from "@/lib/data-schema";
import { boundary, identity, database, bytes, json, ApiError, photoKey } from "@/lib/server/api";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => boundary(async()=>{
  const {userId:owner}=await identity(request),{db}=database();
  // A D1 batch is a transaction, keeping snapshot rows and revision consistent.
  const rows=await db.batch<Record<string,unknown>>([
    db.prepare("SELECT revision FROM sync_state WHERE owner_id = ?").bind(owner),
    db.prepare("SELECT id,name,color,created_at AS createdAt,updated_at AS updatedAt FROM categories WHERE owner_id = ? ORDER BY id").bind(owner),
    db.prepare("SELECT id,title,barcode,product_source AS productSource,comment,rating,price,currency,category_id AS categoryId,note_date AS date,created_at AS createdAt,updated_at AS updatedAt FROM notes WHERE owner_id = ? ORDER BY id").bind(owner),
    db.prepare("SELECT id,note_id AS noteId,width,height,mime_type AS mimeType FROM photos WHERE owner_id = ? ORDER BY note_id,sort_order").bind(owner),
    db.prepare("SELECT theme,default_currency AS defaultCurrency FROM preferences WHERE owner_id = ?").bind(owner),
  ]);
  const notes=rows[2].results.map(n=>({...n,barcode:n.barcode || undefined,productSource:n.productSource || undefined,photos:rows[3].results.filter(p=>p.noteId===n.id).map(({noteId:_noteId,...p})=>p)}));
  return json({revision:rows[0].results[0]?.revision||0,data:snapshotSchema.parse({notes,categories:rows[1].results,preferences:rows[4].results[0]||{theme:"system",defaultCurrency:"EUR"}})});
});
const payloadSchema=z.object({revision:z.number().int().min(0),data:snapshotSchema}).strict();
export const POST = (request: Request) => boundary(async()=>{
  const {userId:owner}=await identity(request),{db}=database();
  const {revision,data:incoming}=payloadSchema.parse(JSON.parse(new TextDecoder().decode(await bytes(request,1024*1024))));
  const [data]=alignDefaultCategories(incoming);
  const photos: Array<Snapshot["notes"][number]["photos"][number]&{noteId:string;sortOrder:number;storageKey:string;createdAt:string;updatedAt:string}>=[];
  const ids=[...new Set(data.notes.flatMap(n=>n.photos.map(p=>p.id)))];
  const existing=await db.prepare("SELECT id FROM photo_objects WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?))").bind(owner,JSON.stringify(ids)).all();
  if(existing.results.length!==ids.length)throw new ApiError(400,"Upload all photos before synchronizing.");
  const prefix=(await photoKey(owner,"placeholder")).replace("placeholder.jpg","");
  for(const n of data.notes)for(const [i,p] of n.photos.entries())photos.push({...p,noteId:n.id,sortOrder:i,storageKey:`${prefix}${p.id}.jpg`,createdAt:n.createdAt,updatedAt:n.updatedAt});
  const token=crypto.randomUUID(),now=new Date().toISOString();
  const guard="EXISTS (SELECT 1 FROM sync_state WHERE owner_id = ? AND mutation_id = ?)";
  const statements=[
    db.prepare("INSERT INTO sync_state (owner_id,revision,mutation_id) VALUES (?,0,'') ON CONFLICT DO NOTHING").bind(owner),
    db.prepare("UPDATE sync_state SET revision = revision + 1, mutation_id = ? WHERE owner_id = ? AND revision = ?").bind(token,owner,revision),
    ...["photos","notes","categories","preferences"].map(table=>db.prepare(`DELETE FROM ${table} WHERE owner_id = ? AND ${guard}`).bind(owner,owner,token)),
    db.prepare(`INSERT INTO categories SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.name'),json_extract(value,'$.color'),json_extract(value,'$.createdAt'),COALESCE(json_extract(value,'$.updatedAt'),json_extract(value,'$.createdAt')) FROM json_each(?) WHERE ${guard}`).bind(owner,JSON.stringify(data.categories),owner,token),
    db.prepare(`INSERT INTO notes (owner_id,id,title,comment,rating,price,currency,category_id,note_date,created_at,updated_at,barcode,product_source) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.title'),json_extract(value,'$.comment'),json_extract(value,'$.rating'),json_extract(value,'$.price'),json_extract(value,'$.currency'),json_extract(value,'$.categoryId'),json_extract(value,'$.date'),json_extract(value,'$.createdAt'),json_extract(value,'$.updatedAt'),json_extract(value,'$.barcode'),json_extract(value,'$.productSource') FROM json_each(?) WHERE ${guard}`).bind(owner,JSON.stringify(data.notes),owner,token),
    db.prepare(`INSERT INTO photos SELECT ?,json_extract(value,'$.noteId'),json_extract(value,'$.id'),json_extract(value,'$.storageKey'),json_extract(value,'$.sortOrder'),json_extract(value,'$.width'),json_extract(value,'$.height'),json_extract(value,'$.mimeType'),json_extract(value,'$.createdAt'),json_extract(value,'$.updatedAt') FROM json_each(?) WHERE ${guard}`).bind(owner,JSON.stringify(photos),owner,token),
    db.prepare(`INSERT INTO preferences SELECT ?,?,?,? WHERE ${guard}`).bind(owner,data.preferences.theme,data.preferences.defaultCurrency,now,owner,token),
  ];
  const results=await db.batch(statements);if(results[1].meta.changes!==1)throw new ApiError(409,"Another device synchronized first. Retry to merge safely.");
  return json({revision:revision+1});
});
