import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repository } from '../lib/repository.ts';
import { SyncService } from '../lib/sync.ts';
import { emptySnapshot } from '../lib/data-schema.ts';

test('transport retries stale cloud revisions and avoids rewriting unchanged snapshots',async()=>{
 await repository.initialize();const time='2026-09-24T00:00:00.000Z';await repository.saveNote({id:'local',title:'Kept',comment:'',rating:null,price:null,currency:'EUR',categoryId:null,date:'2026-09-24',createdAt:time,updatedAt:time,photos:[],syncState:'local'});
 let remote=structuredClone(emptySnapshot),revision=0,posts=0,reads=0;
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  assert.equal(options.headers['X-Memorate-Account'],'stable-account');
  if(options.method==='POST'){posts++;if(posts===1){revision++;return Response.json({error:'Another device synchronized first.'},{status:409});}const payload=JSON.parse(options.body);assert.equal(payload.revision,revision);remote=payload.data;revision++;return Response.json({revision});}
  assert.equal(url,'/api/sync');reads++;return Response.json({revision,data:remote});
 };
 try{const service=new SyncService(undefined,{session:async()=>({user:{id:'stable-account',name:'Test'}})});await service.sync();assert.equal(posts,2);assert.equal(reads,2);assert.equal(remote.notes[0].title,'Kept');await service.sync();assert.equal(posts,2);assert.equal((await repository.notes())[0].title,'Kept');}finally{globalThis.fetch=original;}
});
