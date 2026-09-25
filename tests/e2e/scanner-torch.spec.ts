import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
async function camera(page:Page,supported:boolean){
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({supported})=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,640,360);const media=canvas.captureStream(20),track=media.getVideoTracks()[0];let torch=false;
   document.documentElement.dataset.testTorch='off';document.documentElement.dataset.testCameraStopped='no';
   Object.defineProperty(track,'getCapabilities',{value:()=>supported?{torch:true}:{}});Object.defineProperty(track,'getSettings',{value:()=>({torch})});
   Object.defineProperty(track,'applyConstraints',{value:async (constraints:MediaTrackConstraints)=>{const next=(constraints.advanced?.[0] as {torch?:boolean})?.torch;if(next===undefined)return;if(document.documentElement.dataset.torchFailure==='yes')throw new DOMException('Unavailable','OverconstrainedError');if(document.documentElement.dataset.torchDelay==='yes')await new Promise<void>(resolve=>document.addEventListener('finish-torch',()=>resolve(),{once:true}));if(track.readyState==='live'){torch=next;document.documentElement.dataset.testTorch=torch?'on':'off';}}});
   const stop=track.stop.bind(track);track.stop=()=>{torch=false;document.documentElement.dataset.testTorch='off';document.documentElement.dataset.testCameraStopped='yes';stop();};return media;
  }});
 },{supported});
 await page.goto('/');await page.getByRole('button',{name:'Scan product',exact:true}).click();await expect(page.getByRole('button',{name:'Flashlight',exact:true})).toBeHidden();await page.getByRole('button',{name:'Start camera',exact:true}).click();
}
test('flashlight toggles on/off and resets after stop, lookup and scanner close',async({page})=>{
 await camera(page,true);const button=page.getByRole('button',{name:'Flashlight',exact:true});await expect(button).toHaveAttribute('aria-pressed','false');await button.click();await expect(button).toHaveAttribute('aria-pressed','true');await expect(page.locator('html')).toHaveAttribute('data-test-torch','on');await button.click();await expect(button).toHaveAttribute('aria-pressed','false');await expect(page.locator('html')).toHaveAttribute('data-test-torch','off');
 await button.click();await page.getByRole('button',{name:'Stop camera',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-test-camera-stopped','yes');await expect(page.locator('html')).toHaveAttribute('data-test-torch','off');await expect(button).toBeHidden();
 await page.getByRole('button',{name:'Start camera',exact:true}).click();await expect(button).toHaveAttribute('aria-pressed','false');await button.click();await page.route('**/api/products/96385074?*',r=>r.fulfill({json:{product:null}}));await page.getByLabel('Barcode number').fill('96385074');await page.getByRole('button',{name:'Find product',exact:true}).click();await expect(page.getByText('Product not found',{exact:true})).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-test-torch','off');await expect(page.locator('html')).toHaveAttribute('data-test-camera-stopped','yes');
 await page.getByRole('button',{name:'Scan again',exact:true}).click();await button.click();await page.getByRole('button',{name:'Close scanner',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-test-torch','off');await expect(page.locator('html')).toHaveAttribute('data-test-camera-stopped','yes');
});
test('unsupported cameras have no flashlight control',async({page})=>{
 await camera(page,false);await expect(page.getByRole('button',{name:'Stop camera',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Flashlight',exact:true})).toBeHidden();await page.getByRole('button',{name:'Close scanner',exact:true}).click();
});
test('failed toggle leaves scanning usable and can be retried',async({page})=>{
 await camera(page,true);await page.evaluate(()=>{document.documentElement.dataset.torchFailure='yes';});const button=page.getByRole('button',{name:'Flashlight',exact:true});await button.click();await expect(page.getByText(/flashlight could not be changed/)).toBeVisible();await expect(button).toHaveAttribute('aria-pressed','false');await expect(button).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('data-test-camera-stopped','no');await page.evaluate(()=>{delete document.documentElement.dataset.torchFailure;});await button.click();await expect(button).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Stop camera',exact:true}).click();
});
test('closing during a pending flashlight request cannot re-enable it in a new camera session; pagehide stops it',async({page})=>{
 await camera(page,true);await page.evaluate(()=>{document.documentElement.dataset.torchDelay='yes';});const button=page.getByRole('button',{name:'Flashlight',exact:true});await button.click();await expect(button).toBeDisabled();await page.getByRole('button',{name:'Close scanner',exact:true}).click();await page.getByRole('button',{name:'Scan product',exact:true}).click();await page.getByRole('button',{name:'Start camera',exact:true}).click();await expect(button).toHaveAttribute('aria-pressed','false');await page.evaluate(()=>{delete document.documentElement.dataset.torchDelay;document.dispatchEvent(new Event('finish-torch'));});await expect(button).toBeEnabled();await expect(button).toHaveAttribute('aria-pressed','false');await button.click();await expect(button).toHaveAttribute('aria-pressed','true');await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(button).toBeHidden();await expect(page.locator('html')).toHaveAttribute('data-test-torch','off');await expect(page.locator('html')).toHaveAttribute('data-test-camera-stopped','yes');
});
