import {z} from 'zod';
// An explicit allowlist. Never serialize a private Note or ProductInfo here.
export const publicNoteSchema=z.object({title:z.string().min(1).max(160),comment:z.string().max(20000),rating:z.number().int().min(1).max(5).nullable(),category:z.string().max(32),categoryColor:z.string().regex(/^#[a-fA-F0-9]{6}$/),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),price:z.number().finite().min(0).nullable(),currency:z.string().regex(/^[A-Z]{3}$/),photoCount:z.number().int().min(0).max(12)}).strict();
export type PublicNote=z.infer<typeof publicNoteSchema>;
export const shareTokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export function newShareToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function publicProjection(note:{title:string;comment:string;rating:number|null;date:string;price:number|null;currency:string},category:{name:string;color:string}|undefined,photoCount:number):PublicNote {return publicNoteSchema.parse({title:note.title,comment:note.comment,rating:note.rating,date:note.date,price:note.price,currency:note.currency,category:category?.name||'Uncategorized',categoryColor:category?.color||'#657d85',photoCount});}
