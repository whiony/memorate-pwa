import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repository } from '../lib/repository.ts';
test('v1 IndexedDB upgrades in place without losing local notes or photos',async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('memorate',1);r.onupgradeneeded=()=>{for(const name of ['notes','categories','preferences'])r.result.createObjectStore(name,{keyPath:name==='preferences'?'key':'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise(resolve=>{const tx=db.transaction('notes','readwrite');tx.objectStore('notes').put({id:'legacy',title:'Keep me',photos:[{id:'old-photo',blob:new Blob(['original'])}]});tx.oncomplete=resolve;});db.close();await repository.initialize();const notes=await repository.notes();assert.equal(notes[0].title,'Keep me');assert.equal(await notes[0].photos[0].blob.text(),'original');
});
