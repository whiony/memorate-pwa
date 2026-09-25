import {boundary} from '@/lib/server/api';
import {readPublicNote,publicHeaders} from '@/lib/server/shares';
export const dynamic='force-dynamic';
export const GET=(_request:Request,{params}:{params:Promise<{token:string}>})=>boundary(async()=>Response.json(await readPublicNote((await params).token),{headers:publicHeaders}));
