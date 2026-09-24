import { snapshotSchema, emptySnapshot, type Snapshot } from "./data-schema.ts";
import { repository } from "./repository.ts";
import { mergeSnapshots } from "./sync-merge.ts";
import { newId } from "./id.ts";
export type Session = { user: {id:string;name:string} | null };
export interface AuthProvider { session(): Promise<Session> }
export interface CloudRepository { read(owner:string): Promise<{revision:number;data:Snapshot}>; write(revision:number,data:Snapshot,owner:string): Promise<void>; uploadPhoto(id:string,blob:Blob,owner:string):Promise<void>; downloadPhoto(id:string,owner:string):Promise<Blob> }
class CloudError extends Error { readonly status:number; constructor(message:string,status:number){super(message);this.status=status;} }
async function checked(response:Response) { if(!response.ok) { const data=await response.json().catch(()=>({})) as {error?:string}; throw new CloudError(data.error || "Cloud is unavailable; your local notes are safe.",response.status); } return response; }
export const authProvider:AuthProvider = { session:async()=> (await checked(await fetch("/api/session",{cache:"no-store"}))).json() };
const cloud:CloudRepository = {
  async read(owner){const value=await (await checked(await fetch("/api/sync",{cache:"no-store",headers:{"X-Memorate-Account":owner}}))).json() as {revision:number;data:unknown};return {revision:value.revision,data:snapshotSchema.parse(value.data)};},
  async write(revision,data,owner){await checked(await fetch("/api/sync",{method:"POST",headers:{"Content-Type":"application/json","X-Memorate-Account":owner},body:JSON.stringify({revision,data})}));},
  async uploadPhoto(id,blob,owner){await checked(await fetch(`/api/photos/${encodeURIComponent(id)}`,{method:"PUT",headers:{"Content-Type":"image/jpeg","X-Memorate-Account":owner},body:blob}));},
  async downloadPhoto(id,owner){return (await checked(await fetch(`/api/photos/${encodeURIComponent(id)}`,{cache:"no-store",headers:{"X-Memorate-Account":owner}}))).blob();},
};
export class SyncService {
  private running:Promise<{conflicts:number;pending:boolean;changed:boolean}>|null=null;
  private remote: CloudRepository; private auth: AuthProvider;
  constructor(remote:CloudRepository=cloud,auth:AuthProvider=authProvider){this.remote=remote;this.auth=auth;}
  sync(): Promise<{conflicts:number;pending:boolean;changed:boolean}> { if(this.running)return this.running; const execute=async()=>{if(typeof navigator!=="undefined" && navigator.locks)return await navigator.locks.request("memorate-sync",()=>this.retry());return await this.retry();};const pending=execute().finally(()=>{this.running=null;});this.running=pending;return pending; }
  private async retry(){
    for(let attempt=0;;attempt++)try{return await this.perform();}catch(error){
      if(!(error instanceof CloudError) || error.status!==409 || attempt>=2)throw error;
      await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));
    }
  }
  private async perform(){
    const {user}=await this.auth.session();if(!user)throw new Error("Sign in before enabling cloud backup.");
    let meta=await repository.syncMetadata();
    if(meta && meta.owner!==user.id)throw new Error("This browser collection belongs to another signed-in account. Use a separate browser profile to keep collections isolated.");
    if(!meta){meta={owner:user.id,base:emptySnapshot};await repository.setSyncMetadata(meta);}
    const local=await repository.snapshot(),remote=await this.remote.read(user.id);
    const merged=mergeSnapshots(meta.base,local.data,remote.data,newId);snapshotSchema.parse(merged.snapshot);
    const remotePhotos=new Set(remote.data.notes.flatMap(n=>n.photos.map(p=>p.id)));
    for(const n of merged.snapshot.notes)for(const p of n.photos){if(!local.blobs.has(p.id))local.blobs.set(p.id,await this.remote.downloadPhoto(p.id,user.id)); if(!remotePhotos.has(p.id)){await this.remote.uploadPhoto(p.id,local.blobs.get(p.id)!,user.id);remotePhotos.add(p.id);}}
    // A second session check protects a sign-out/account switch during transfers.
    if((await this.auth.session()).user?.id!==user.id)throw new Error("Account changed during sync. Retry after signing in.");
    if(!sameSnapshot(remote.data,merged.snapshot))await this.remote.write(remote.revision,merged.snapshot,user.id);
    for(let attempt=0;attempt<4;attempt++){
      const current=await repository.snapshot();
      const final=current.generation===local.generation ? merged.snapshot : mergeSnapshots(local.data,current.data,merged.snapshot,newId).snapshot;
      const blobs=new Map([...local.blobs,...current.blobs]);
      try {await repository.replaceSnapshot(final,blobs,current.generation,{owner:user.id,base:merged.snapshot,syncedAt:new Date().toISOString()});return {conflicts:merged.conflicts,pending:!sameSnapshot(final,merged.snapshot),changed:!sameSnapshot(current.data,final)};} catch(error){if(attempt===3)throw error;}
    }
    return {conflicts:merged.conflicts,pending:true,changed:true};
  }
}
function sameSnapshot(a:Snapshot,b:Snapshot){
  const canonical=(value:Snapshot)=>JSON.stringify(snapshotSchema.parse({...value,notes:[...value.notes].sort((x,y)=>x.id.localeCompare(y.id)),categories:[...value.categories].sort((x,y)=>x.id.localeCompare(y.id))}));
  return canonical(a)===canonical(b);
}
export const syncService=new SyncService();
