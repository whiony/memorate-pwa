import {boundary,identity,database,json} from '@/lib/server/api';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>boundary(async()=>{const {userId}=await identity(request),{db}=database();const rows=await db.prepare("SELECT note_id AS noteId, token, json_extract(public_json,'$.title') AS title FROM shared_notes WHERE owner_id=? ORDER BY created_at DESC").bind(userId).all();return json({shares:rows.results});});
