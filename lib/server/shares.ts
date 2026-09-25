import {database,ApiError} from './api';
import {publicNoteSchema,shareTokenSchema} from '../public-note';
export async function readPublicNote(token:string){
 if(!shareTokenSchema.safeParse(token).success)throw new ApiError(404,'This shared note is unavailable.');
 const {db}=database();const row=await db.prepare('SELECT public_json FROM shared_notes WHERE token = ?').bind(token).first<{public_json:string}>();
 if(!row)throw new ApiError(404,'This shared note is unavailable.');return publicNoteSchema.parse(JSON.parse(row.public_json));
}
export const sharedPhotoKey=(token:string,index:number)=>`shared/${token}/${index}.jpg`;
export const publicHeaders={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'};
