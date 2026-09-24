import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
test('sync endpoint repairs legacy defaults atomically and preserves distinct custom categories',async({request})=>{
 const owner=`category-api-${crypto.randomUUID()}`;
 const headers={'X-Memorate-Account':owner,'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'qa@sites.test',Origin:'http://127.0.0.1:4175'};
 const timestamp='2026-09-24T12:00:00.000Z';
 const data={categories:[{id:'food',name:'Food',color:'#C7A576',createdAt:timestamp},{id:'old-food',name:'Food',color:'#C7A576',createdAt:timestamp},{id:'custom-food',name:'Food',color:'#123456',createdAt:timestamp}],notes:[{id:'legacy-note',title:'Keep this memory',comment:'Keep this comment',rating:4,price:3,currency:'EUR',categoryId:'old-food',date:'2026-09-24',createdAt:timestamp,updatedAt:timestamp,photos:[]}],preferences:{theme:'system',defaultCurrency:'EUR'}};
 for(let revision=0;revision<2;revision++){
  const response=await request.post('/api/sync',{headers,data:{revision,data}});expect(await response.json()).toEqual({revision:revision+1});
  const saved=await(await request.get('/api/sync',{headers})).json();expect(saved.data.categories.map((c:{id:string})=>c.id).sort()).toEqual(['custom-food','food']);expect(saved.data.notes).toEqual([{...data.notes[0],categoryId:'food'}]);
 }
});
async function seedNotes(page:Page) {
 await page.goto('/');await expect(page.getByRole('heading',{name:/All notes/})).toBeVisible();
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('memorate',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>(resolve=>{const tx=db.transaction('notes','readwrite');for(let i=0;i<16;i++)tx.objectStore('notes').put({id:`scroll-${i}`,title:`Memory ${i}`,rating:4,categoryId:'food',date:'2026-09-24',comment:'A memory',price:3,currency:'EUR',photos:[],createdAt:'2026-09-24T12:00:00.000Z',updatedAt:'2026-09-24T12:00:00.000Z',syncState:'local'});tx.oncomplete=()=>resolve();});db.close();});await page.reload();await expect(page.locator('.note-card')).toHaveCount(16);
}
test('Settings starts at top and collection restores its own scroll; desktop content is centered',async({page})=>{
 await page.setViewportSize({width:1280,height:750});await seedNotes(page);
 for(let i=0;i<2;i++){
  await page.evaluate(()=>window.scrollTo(0,650));await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  const settings=(await page.locator('.settings-view').boundingBox())!,container=(await page.locator('.app-container').boundingBox())!;expect(settings.width).toBeLessThanOrEqual(720);expect(Math.abs(settings.x+settings.width/2-container.x-container.width/2)).toBeLessThan(1);
  await page.evaluate(()=>scrollTo(0,300));await page.getByRole('button',{name:'Collection',exact:true}).click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(650);
 }
 await page.locator('.note-card').nth(6).click();await expect(page.locator('.detail-view')).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await page.getByRole('button',{name:'Memorate home'}).click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
});
test('mobile New Note resets the scroll container and focuses no text field on every open',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:390,height:650},isMobile:true,hasTouch:true});const page=await ctx.newPage();await seedNotes(page);await page.evaluate(()=>scrollTo(0,500));
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'Add note',exact:true}).click();const form=page.locator('.editor-scroll');await expect(form).toBeVisible();await expect.poll(()=>form.evaluate(e=>e.scrollTop)).toBe(0);
  await expect(page.getByRole('button',{name:'Close',exact:true})).toBeFocused();const title=page.getByLabel('Title *',{exact:true});await expect(title).toBeInViewport();expect(await page.evaluate(()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||''))).toBe(false);
  await title.fill(`Draft ${i}`);await expect(title).toHaveValue(`Draft ${i}`);await page.getByLabel('Comment',{exact:true}).fill('Scrolled down to type');await form.evaluate(e=>e.scrollTop=e.scrollHeight);expect(await form.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(form).toBeHidden();
 }
 await page.getByRole('button',{name:'Add note',exact:true}).click();await expect(page.getByLabel('Title *',{exact:true})).toHaveValue('');await expect.poll(()=>page.locator('.editor-scroll').evaluate(e=>e.scrollTop)).toBe(0);await ctx.close();
});
test('two signed-in clients repair old default duplicates and retain note links across reload and sync',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext();const p=await a.newPage(),q=await b.newPage();await seedNotes(p);await seedNotes(q);
 await p.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('memorate',2);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction(['categories','notes'],'readwrite');tx.objectStore('categories').put({id:'old-food',name:'Food',color:'#C7A576',createdAt:'2026-09-24T12:00:00.000Z'});const r=tx.objectStore('notes').get('scroll-0');r.onsuccess=()=>tx.objectStore('notes').put({...r.result,id:'legacy-linked-note',title:'Legacy linked note',categoryId:'old-food'});tx.oncomplete=()=>resolve();});db.close();});
 const headers={'oai-authenticated-user-id':`category-${crypto.randomUUID()}`,'oai-authenticated-user-email':'same@sites.test'};await a.setExtraHTTPHeaders(headers);await b.setExtraHTTPHeaders(headers);
 await p.reload();await p.getByRole('button',{name:'Settings',exact:true}).click();await expect(p.getByText('Cloud backup is up to date',{exact:true})).toBeVisible();await q.reload();await expect(q.getByRole('heading',{name:'Legacy linked note',exact:true})).toBeVisible();
 for(const page of [p,q]){await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByText('Cloud backup is up to date',{exact:true})).toBeVisible();for(const name of ['Food','Clothes','Beauty','Places','Other'])await expect(page.getByLabel(`Rename ${name}`,{exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Collection',exact:true}).click();const card=page.locator('.note-card').filter({has:page.getByRole('heading',{name:'Legacy linked note',exact:true})});await expect(card.locator('.category-label')).toHaveText('Food');}
 await a.close();await b.close();
});
