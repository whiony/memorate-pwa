import { snapshotSchema, emptySnapshot, type Snapshot } from "./data-schema.ts";
import { repository } from "./repository.ts";
import { mergeSnapshots } from "./sync-merge.ts";
import { newId } from "./id.ts";
export type Session = { user: {id:string;name:string} | null };
export interface AuthProvider { session(): Promise<Session> }
export interface CloudRepository { read(): Promise<{revision:number;data:Snapshot}>; write(revision:number,data:Snapshot): Promise<void>; uploadPhoto(id:string,blob:Blob):Promise<void>; downloadPhoto(id:string):Promise<Blob> }
async function checked(response:Response) { if(!response.ok) { const data=await response.json().catch(()=>({})) as {error?:string}; throw new Error(data.error || "Cloud is unavailable; your local notes are safe."); } return response; }
export const authProvider:AuthProvider = { session:async()=> (await checked(await fetch("/api/session",{cache:"no-store"}))).json() };
const cloud:CloudRepository = {
  async read(){const value=await (await checked(await fetch("/api/sync",{cache:"no-store"}))).json() as {revision:number;data:unknown};return {revision:value.revision,data:snapshotSchema.parse(value.data)};},
  async write(revision,data){await checked(await fetch("/api/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision,data})}));},
  async uploadPhoto(id,blob){await checked(await fetch(`/api/photos/${encodeURIComponent(id)}`,{method:"PUT",headers:{"Content-Type":"image/jpeg"},body:blob}));},
  async downloadPhoto(id){return (await checked(await fetch(`/api/photos/${encodeURIComponent(id)}`,{cache:"no-store"}))).blob();},
};
export class SyncService {
  private running:Promise<{conflicts:number}>|null=null;
  private remote: CloudRepository; private auth: AuthProvider;
  constructor(remote:CloudRepository=cloud,auth:AuthProvider=authProvider){this.remote=remote;this.auth=auth;}
  sync(): Promise<{conflicts:number}> { if(this.running)return this.running; const execute=async()=>{if(typeof navigator!=="undefined" && navigator.locks)return await navigator.locks.request("memorate-sync",()=>this.perform());return await this.perform();};const pending=execute().finally(()=>{this.running=null;});this.running=pending;return pending; }
  private async perform(){
    const {user}=await this.auth.session();if(!user)throw new Error("Sign in before enabling cloud backup.");
    let meta=await repository.syncMetadata();
    if(meta && meta.owner!==user.id)throw new Error("This browser collection belongs to another signed-in account. Use a separate browser profile to keep collections isolated.");
    if(!meta){meta={owner:user.id,base:emptySnapshot};await repository.setSyncMetadata(meta);}
    const local=await repository.snapshot(),remote=await this.remote.read();
    const merged=mergeSnapshots(meta.base,local.data,remote.data,newId);snapshotSchema.parse(merged.snapshot);
    const remotePhotos=new Set(remote.data.notes.flatMap(n=>n.photos.map(p=>p.id)));
    for(const n of merged.snapshot.notes)for(const p of n.photos){if(!local.blobs.has(p.id))local.blobs.set(p.id,await this.remote.downloadPhoto(p.id)); if(!remotePhotos.has(p.id)){await this.remote.uploadPhoto(p.id,local.blobs.get(p.id)!);remotePhotos.add(p.id);}}
    // A second session check protects a sign-out/account switch during transfers.
    if((await this.auth.session()).user?.id!==user.id)throw new Error("Account changed during sync. Retry after signing in.");
    await this.remote.write(remote.revision,merged.snapshot);
    for(let attempt=0;attempt<4;attempt++){
      const current=await repository.snapshot();
      const final=current.generation===local.generation ? merged.snapshot : mergeSnapshots(local.data,current.data,merged.snapshot,newId).snapshot;
      const blobs=new Map([...local.blobs,...current.blobs]);
      try {await repository.replaceSnapshot(final,blobs,current.generation,{owner:user.id,base:merged.snapshot,syncedAt:new Date().toISOString()});return {conflicts:merged.conflicts};} catch(error){if(attempt===3)throw error;}
    }
    return {conflicts:merged.conflicts};
  }
}
export const syncService=new SyncService();
