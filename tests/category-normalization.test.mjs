import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CATEGORIES } from '../lib/models.ts';
import { repository } from '../lib/repository.ts';
import { alignDefaultCategories } from '../lib/category-normalization.ts';
import { mergeSnapshots } from '../lib/sync-merge.ts';
import { mergeBackup } from '../lib/backup.ts';
import { emptySnapshot } from '../lib/data-schema.ts';
const date='2026-09-24T12:00:00.000Z';
const note={id:'memory',title:'Keep me',comment:'Original',rating:4,price:4,currency:'EUR',categoryId:'legacy-food',date:'2026-09-24',createdAt:date,updatedAt:date,photos:[]};
const snapshot=(categories,notes=[])=>({...structuredClone(emptySnapshot),categories,notes});
const oldFood={...INITIAL_CATEGORIES[0],id:'legacy-food',createdAt:date};
test('original Sites palette merges with current defaults while custom colors and names survive',()=>{
 const colors={food:'#EBC984',clothes:'#CBBBE4',beauty:'#E7B9AF',places:'#A6D3D0',other:'#BAC5D4'};
 const legacy=INITIAL_CATEGORIES.map(c=>({...c,id:`sites-${c.id}`,color:colors[c.id]}));
 const [fixed]=alignDefaultCategories(snapshot([...INITIAL_CATEGORIES,...legacy,{...oldFood,id:'custom',name:'Everywhere',color:'#A6D3D0'}],legacy.map(c=>({...note,id:`note-${c.id}`,categoryId:c.id}))));
 assert.equal(fixed.categories.length,6);assert.ok(fixed.categories.some(c=>c.id==='custom'));assert.deepEqual(fixed.notes.map(n=>n.categoryId),INITIAL_CATEGORIES.map(c=>c.id));
 assert.deepEqual(alignDefaultCategories(fixed)[0],fixed);
 const merged=mergeSnapshots(emptySnapshot,snapshot(INITIAL_CATEGORIES),snapshot(legacy),()=>{throw new Error('No recovery category should be created');});assert.equal(merged.snapshot.categories.length,5);assert.equal(merged.conflicts,0);
});
test('initialization atomically repairs default aliases and preserves notes/photos; repeated initialization is a no-op',async()=>{
 const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('memorate',2);r.onupgradeneeded=()=>{for(const name of ['notes','categories','preferences','metadata'])r.result.createObjectStore(name,{keyPath:['notes','categories'].includes(name)?'id':'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise(resolve=>{const tx=database.transaction(['notes','categories'],'readwrite');for(const c of [...INITIAL_CATEGORIES,oldFood])tx.objectStore('categories').put(c);tx.objectStore('notes').put({...note,syncState:'local',photos:[{id:'photo',blob:new Blob(['keep photo']),width:23,height:24}]});tx.oncomplete=resolve;});database.close();
 await Promise.all([repository.initialize(),repository.initialize()]);const first=await repository.snapshot();assert.equal(first.data.categories.length,5);assert.equal(first.data.notes[0].categoryId,'food');assert.equal(first.data.notes[0].updatedAt,date);assert.equal(await first.blobs.get('photo').text(),'keep photo');
 await repository.initialize();assert.equal((await repository.snapshot()).generation,first.generation);
 await repository.saveCategory((await repository.categories())[0]);assert.equal((await repository.snapshot()).generation,first.generation);
 await repository.deleteCategory('food');await repository.initialize();assert.equal((await repository.categories()).some(c=>c.id==='food'),false);
});
test('initial state with equivalent legacy IDs is not reseeded',()=>{const [fixed]=alignDefaultCategories(snapshot([oldFood],[note]));assert.equal(fixed.categories.length,1);assert.equal(fixed.notes[0].categoryId,'legacy-food');});
test('two clients converge across first sync, old baselines, repeated sync and timestamp-only differences',()=>{
 const a=snapshot(INITIAL_CATEGORIES.map(c=>({...c,updatedAt:''})),[{...note,id:'desktop',categoryId:'food'}]);
 const b=snapshot(INITIAL_CATEGORIES.map(c=>({...c,id:`legacy-${c.id}`,createdAt:date,updatedAt:date})),[note]);
 let ids=0;const makeId=()=>`conflict-${++ids}`;
 const uploaded=mergeSnapshots(emptySnapshot,a,b,makeId);assert.equal(uploaded.conflicts,0);assert.equal(uploaded.snapshot.categories.length,5);assert.equal(uploaded.snapshot.notes.length,2);assert.ok(uploaded.snapshot.notes.every(n=>n.categoryId==='food'));
 const phone=mergeSnapshots(b,b,uploaded.snapshot,makeId);assert.equal(phone.conflicts,0);assert.equal(phone.snapshot.notes.length,2);assert.equal(phone.snapshot.categories.length,5);
 const desktop=mergeSnapshots(a,a,phone.snapshot,makeId);assert.equal(desktop.snapshot.categories.length,5);assert.equal(desktop.snapshot.notes.length,2);
 assert.deepEqual(mergeSnapshots(desktop.snapshot,desktop.snapshot,phone.snapshot,makeId).snapshot,phone.snapshot);assert.equal(ids,0);
 const changedTime=structuredClone(desktop.snapshot);changedTime.categories[0].updatedAt='2026-09-25T00:00:00.000Z';assert.equal(mergeSnapshots(emptySnapshot,changedTime,desktop.snapshot,makeId).conflicts,0);
});
test('import coalesces equivalent defaults before comparing notes and preserves custom distinctions',()=>{
 const existing=snapshot(INITIAL_CATEGORIES,[{...note,categoryId:'food'}]);const incoming=snapshot([oldFood],[note]);const result=mergeBackup(existing,incoming);assert.equal(result.categories.length,5);assert.equal(result.notes.length,1);assert.equal(result.notes[0].categoryId,'food');
 const custom=[{...oldFood,id:'food-red',color:'#ff0000'},{...oldFood,id:'food-ideas',name:'Food ideas'},{...oldFood,id:'custom-a',name:'Journal'},{...oldFood,id:'custom-b',name:'Journal'}];
 const [fixed]=alignDefaultCategories(snapshot([...INITIAL_CATEGORIES,oldFood,...custom]));assert.equal(fixed.categories.length,9);for(const c of custom)assert.ok(fixed.categories.some(x=>x.id===c.id));
});
test('renamed defaults and real concurrent category edits remain distinct; category deletions do not resurrect',()=>{
 const base=snapshot([INITIAL_CATEGORIES[0]],[{...note,categoryId:'food'}]);const local=structuredClone(base);local.categories[0].name='Groceries';const remote=snapshot([INITIAL_CATEGORIES[0],oldFood],[{...note,categoryId:'legacy-food'}]);let id=0;
 const result=mergeSnapshots(emptySnapshot,local,remote,()=>`recovery${++id}`).snapshot;assert.ok(result.categories.some(c=>c.name==='Groceries'));assert.ok(result.categories.some(c=>c.name==='Food'));assert.ok(result.notes.every(n=>result.categories.some(c=>c.id===n.categoryId)));
 const deleted=snapshot([], [{...note,categoryId:null,updatedAt:'2026-09-25T00:00:00.000Z'}]);const removed=mergeSnapshots(base,deleted,base,()=> 'unused').snapshot;assert.equal(removed.categories.length,0);assert.equal(removed.notes[0].categoryId,null);
 const other=structuredClone(base);other.categories[0].name='Meals';assert.equal(mergeSnapshots(base,local,other,()=> 'recovered-category').conflicts,1);
});
