import { alignDefaultCategories, sameCategoryContent } from "./category-normalization.ts";
import { Zip, ZipPassThrough, Unzip, UnzipInflate } from "fflate";
import { snapshotSchema, type Snapshot } from "./data-schema.ts";
import { repository } from "./repository.ts";
import { newId } from "./id.ts";
const MAX_ARCHIVE = 256 * 1024 * 1024, MAX_PHOTO = 8 * 1024 * 1024, MAX_JSON = 8 * 1024 * 1024;
const encoder = new TextEncoder();
export async function createBackup(data: Snapshot, blobs: Map<string, Blob>): Promise<Blob> {
  snapshotSchema.parse(data);
  const parts: Uint8Array<ArrayBuffer>[] = []; let size = 0; let failure: Error | null = null;
  const zip = new Zip((error, chunk) => { if (error) { failure = error; return; } size += chunk.length; if (size > MAX_ARCHIVE) { failure = new Error("Backup exceeds the 256 MB limit."); return; } parts.push(new Uint8Array(chunk)); });
  const json = new ZipPassThrough("data.json"); zip.add(json); json.push(encoder.encode(JSON.stringify({ backup_format_version: 1, schema_version: 1, exported_at: new Date().toISOString(), ...data })), true);
  const seen = new Set<string>();
  for (const note of data.notes) for (const photo of note.photos) {
    if (seen.has(photo.id)) continue; seen.add(photo.id);
    const blob = blobs.get(photo.id); if (!blob) throw new Error("A photo is missing; backup was not created.");
    if (blob.size > MAX_PHOTO) throw new Error("Photo exceeds backup size limit.");
    const entry = new ZipPassThrough(`photos/${photo.id}.jpg`); zip.add(entry);
    const reader = blob.stream().getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; entry.push(value); if (failure) { await reader.cancel(); throw failure; } }
    entry.push(new Uint8Array(), true);
  }
  zip.end(); if (failure) throw failure;
  return new Blob(parts, { type: "application/zip" });
}
// Inspect the central directory before decompression; reject ZIP64, encrypted
// entries, broken sizes and bad CRCs rather than accepting partially corrupt data.
async function zipDirectory(file: Blob) {
  const start = Math.max(0, file.size - 65557), tail = new Uint8Array(await file.slice(start).arrayBuffer()), view = new DataView(tail.buffer);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === tail.length) { end = i; break; }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error("Invalid ZIP directory.");
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  if (count > 24001 || count !== view.getUint16(end + 8, true) || size > 4 * 1024 * 1024 || offset + size !== start + end) throw new Error("Unsupported ZIP structure.");
  const bytes = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer()), directory = new DataView(bytes.buffer);
  const records = new Map<string, { crc: number; size: number }>(); let position = 0, total = 0;
  for (let i = 0; i < count; i++) {
    if (position + 46 > bytes.length || directory.getUint32(position, true) !== 0x02014b50) throw new Error("Corrupt ZIP directory.");
    const flags = directory.getUint16(position + 8, true), method = directory.getUint16(position + 10, true), compressed = directory.getUint32(position + 20, true), expanded = directory.getUint32(position + 24, true), nameSize = directory.getUint16(position + 28, true), extra = directory.getUint16(position + 30, true), comment = directory.getUint16(position + 32, true), local = directory.getUint32(position + 42, true);
    if (flags & 1 || ![0,8].includes(method) || position+46+nameSize+extra+comment>bytes.length || local+30+compressed>offset) throw new Error("Unsupported ZIP entry.");
    const name = new TextDecoder("utf-8", {fatal:true}).decode(bytes.slice(position+46,position+46+nameSize));
    total += expanded;
    if (records.has(name) || total>MAX_ARCHIVE || expanded>(name === "data.json" ? MAX_JSON : MAX_PHOTO)) throw new Error("ZIP exceeds safe limits.");
    records.set(name,{crc:directory.getUint32(position+16,true),size:expanded}); position += 46+nameSize+extra+comment;
  }
  if (position!==bytes.length) throw new Error("Invalid ZIP directory length."); return records;
}
const crcTable = Array.from({length:256},(_,n)=>{let crc=n;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);return crc>>>0;});
export async function parseBackup(file: Blob): Promise<{ data: Snapshot; blobs: Map<string, Blob> }> {
  if (file.size > MAX_ARCHIVE || file.size < 4) throw new Error("Invalid backup size (maximum 256 MB).");
  const signature = new Uint8Array(await file.slice(0,4).arrayBuffer());
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) return parseLegacy(file);
  const directory = await zipDirectory(file);
  const entries = new Map<string, Uint8Array<ArrayBuffer>[]>(); let total = 0; let failure: Error | null = null; let completed = 0;
  const unzip = new Unzip(entry => {
    if (!/^(data\.json|photos\/[a-zA-Z0-9_-]{1,100}\.jpg)$/.test(entry.name) || entries.has(entry.name) || entries.size >= 24001) throw new Error("Unsafe or duplicate ZIP entry.");
    if (entry.originalSize && entry.originalSize > (entry.name === "data.json" ? MAX_JSON : MAX_PHOTO)) throw new Error("ZIP entry is too large.");
    const parts: Uint8Array<ArrayBuffer>[] = []; entries.set(entry.name, parts); let size = 0; let crc = 0xffffffff;
    entry.ondata = (error, chunk, final) => { if (error) { failure = error; return; } size += chunk.length; total += chunk.length; if (total > MAX_ARCHIVE || size > (entry.name === "data.json" ? MAX_JSON : MAX_PHOTO)) { entry.terminate(); throw new Error("Backup expands beyond the allowed size."); } for (const byte of chunk) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]; parts.push(new Uint8Array(chunk)); if (final) { const expected = directory.get(entry.name); if (!expected || expected.size !== size || expected.crc !== ((crc ^ 0xffffffff) >>> 0)) throw new Error("Corrupt ZIP checksum."); completed++; } };
    entry.start();
  }); unzip.register(UnzipInflate);
  for (let offset = 0; offset < file.size; offset += 65536) { unzip.push(new Uint8Array(await file.slice(offset,offset+65536).arrayBuffer()), offset+65536 >= file.size); if (failure) throw failure; }
  if (!entries.has("data.json") || completed !== entries.size || directory.size !== entries.size) throw new Error("Incomplete ZIP backup.");
  const parsed = JSON.parse(await new Blob(entries.get("data.json")!).text());
  if (parsed.backup_format_version !== 1 || parsed.schema_version !== 1) throw new Error("Unsupported backup or schema version. Your data was not changed.");
  if (typeof parsed.exported_at !== "string" || Number.isNaN(Date.parse(parsed.exported_at))) throw new Error("Invalid backup timestamp.");
  const { backup_format_version: _format, schema_version: _schema, exported_at: _exported, ...snapshot } = parsed;
  const data = snapshotSchema.parse(snapshot); const blobs = new Map<string, Blob>(); const used = new Set(["data.json"]);
  for (const note of data.notes) for (const photo of note.photos) { const path = `photos/${photo.id}.jpg`; const parts = entries.get(path); if (!parts) throw new Error("A photo is missing from the backup."); const blob = new Blob(parts, {type:"image/jpeg"}); const bytes = new Uint8Array(await blob.slice(0,3).arrayBuffer()); if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error("Invalid JPEG photo."); blobs.set(photo.id,blob); used.add(path); }
  if (used.size !== entries.size) throw new Error("Backup contains unrecognized files.");
  return { data, blobs };
}
async function parseLegacy(file: Blob) {
  if (file.size > 32 * 1024 * 1024) throw new Error("Legacy JSON backup is too large.");
  const raw = JSON.parse(await file.text());
  if (raw.format !== "memorate-export" || raw.version !== 1 || !Array.isArray(raw.notes)) throw new Error("Not a supported Memorate backup.");
  if (Object.keys(raw).some(k => !["format","version","exportedAt","notes","categories","preferences"].includes(k))) throw new Error("Unsupported legacy backup fields.");
  const blobs = new Map<string,Blob>();
  const notes = raw.notes.map((note: Record<string,unknown>) => { const { syncState: _sync, photos, ...rest } = note; if (!Array.isArray(photos)) throw new Error("Invalid photos"); return { ...rest, photos: photos.map(p => { if (!p || typeof p.data !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.data) || p.data.length > MAX_PHOTO * 1.4) throw new Error("Invalid legacy photo"); const bytes = Uint8Array.from(atob(p.data.split(",")[1]), c => c.charCodeAt(0)); if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error("Invalid JPEG"); blobs.set(p.id, new Blob([bytes],{type:"image/jpeg"})); return {id:p.id,mimeType:"image/jpeg",width:1000,height:1000}; }) }; });
  return { data: snapshotSchema.parse({ notes, categories: raw.categories, preferences: raw.preferences }), blobs };
}
export function mergeBackup(existing: Snapshot, incoming: Snapshot, makeId = newId): Snapshot {
  [existing,incoming] = alignDefaultCategories(existing,incoming);
  const categories = [...existing.categories], notes = [...existing.notes]; const categoryIds = new Map<string,string>();
  for (const c of incoming.categories) { const old = categories.find(x => x.id === c.id); if (old && sameCategoryContent(old,c)) { categoryIds.set(c.id,c.id); continue; } const id = old ? makeId() : c.id; categories.push({...c,id}); categoryIds.set(c.id,id); }
  for (const n of incoming.notes) { const next = {...n,categoryId:n.categoryId ? categoryIds.get(n.categoryId)! : null}; const old = notes.find(x=>x.id===n.id); if (old && JSON.stringify(old) === JSON.stringify(next)) continue; notes.push({...next,id:old ? makeId() : n.id}); }
  return snapshotSchema.parse({notes,categories,preferences: existing.notes.length || existing.categories.length ? existing.preferences : incoming.preferences});
}
export async function exportBackup() { const {data,blobs} = await repository.snapshot(); return createBackup(data,blobs); }
export async function importBackup(file: Blob) {
  const incoming = await parseBackup(file), current = await repository.snapshot();
  // Photos are immutable. If an imported ID names different bytes, remap it and
  // every imported reference before merging, never replace an existing photo.
  const remap = new Map<string,string>();
  for (const [id,blob] of incoming.blobs) { const old = current.blobs.get(id); if (!old) continue; const a = new Uint8Array(await old.arrayBuffer()), b = new Uint8Array(await blob.arrayBuffer()); if (a.length !== b.length || a.some((v,i)=>v!==b[i])) remap.set(id,newId()); }
  for (const n of incoming.data.notes) n.photos = n.photos.map(p=>({...p,id:remap.get(p.id)||p.id}));
  for (const [id,blob] of incoming.blobs) current.blobs.set(remap.get(id)||id,blob);
  const merged = mergeBackup(current.data,incoming.data);
  // The initial seeded categories should not suppress restoring preferences.
  if (current.data.notes.length === 0) merged.preferences = incoming.data.preferences;
  await repository.replaceSnapshot(merged,current.blobs,current.generation);
}
