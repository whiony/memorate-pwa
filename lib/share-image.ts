import type {Note,Category} from './models';
import type {Palette} from './themes';
export const STAR_PATH='M47.57,10.57 Q50,6 52.43,10.57 L61.63,27.84 Q63.52,31.39 67.48,32.09 L86.75,35.50 Q91.85,36.40 88.25,40.13 L74.67,54.21 Q71.87,57.11 72.43,61.10 L75.14,80.47 Q75.86,85.60 71.21,83.33 L53.62,74.76 Q50,73 46.38,74.76 L28.79,83.33 Q24.14,85.60 24.86,80.47 L27.57,61.10 Q28.13,57.11 25.33,54.21 L11.75,40.13 Q8.15,36.40 13.25,35.50 L32.52,32.09 Q36.48,31.39 38.37,27.84 Z';
function star(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,color:string){ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);ctx.fillStyle=color;ctx.fill(new Path2D(STAR_PATH));ctx.restore();}
function lines(ctx:CanvasRenderingContext2D,text:string,width:number){const output:string[]=[];let line='';for(const word of text.trim().split(/\s+/)){if(ctx.measureText(line+(line?' ':'')+word).width<=width){line+=(line?' ':'')+word;continue;}if(line)output.push(line);line='';for(const char of word){if(ctx.measureText(line+char).width>width){output.push(line);line='';}line+=char;}}if(line)output.push(line);return output;}
function drawLines(ctx:CanvasRenderingContext2D,rows:string[],x:number,y:number,lineHeight:number,max:number,width:number){rows.slice(0,max).forEach((line,index)=>{if(index===max-1&&rows.length>max){while(ctx.measureText(line+'…').width>width)line=line.slice(0,-1);line+='…';}ctx.fillText(line,x,y+index*lineHeight);});}
/** A fixed poster composition, rendered from an allowlist of review fields. */
export async function createNoteImage(note:Note,category:Category|undefined,p:Palette):Promise<Blob>{
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable in this browser.');
 ctx.fillStyle=p.background;ctx.fillRect(0,0,1080,1350);ctx.fillStyle=p.surface;ctx.beginPath();ctx.roundRect(32,32,1016,1286,36);ctx.fill();
 let y=140;
 if(note.photos[0]){const url=URL.createObjectURL(note.photos[0].blob);try{const photo=new Image();photo.src=url;await photo.decode();ctx.save();ctx.beginPath();ctx.roundRect(64,64,952,492,24);ctx.clip();const scale=Math.max(952/photo.naturalWidth,492/photo.naturalHeight);ctx.drawImage(photo,64+(952-photo.naturalWidth*scale)/2,64+(492-photo.naturalHeight*scale)/2,photo.naturalWidth*scale,photo.naturalHeight*scale);ctx.restore();}finally{URL.revokeObjectURL(url);}y=613;}
 else {star(ctx,825,94,120,p.accent);y=275;}
 ctx.fillStyle=p.sub;ctx.font='600 25px "Helvetica Neue", Arial, sans-serif';ctx.fillText((category?.name||'Uncategorized').toLocaleUpperCase(),76,y);y+=62;
 let size=note.photos.length?56:76;ctx.font=`700 ${size}px "Helvetica Neue", Arial, sans-serif`;let title=lines(ctx,note.title,928);while(title.length>4&&size>40){size-=2;ctx.font=`700 ${size}px "Helvetica Neue", Arial, sans-serif`;title=lines(ctx,note.title,928);}ctx.fillStyle=p.ink;drawLines(ctx,title,76,y,size*1.13,5,928);y+=Math.min(title.length,5)*size*1.13+25;
 if(note.rating!==null){ctx.font='700 38px "Helvetica Neue", Arial, sans-serif';ctx.fillText(note.rating.toFixed(1),76,y);star(ctx,142,y-37,44,p.accent);y+=66;}
 if(note.comment){ctx.fillStyle=p.sub;ctx.font='400 32px "Helvetica Neue", Arial, sans-serif';const available=Math.max(1,Math.floor((1164-y)/43));drawLines(ctx,lines(ctx,note.comment,928),76,y,43,Math.min(available,6),928);}
 ctx.strokeStyle=p.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(32,1210);for(let x=32;x<1048;x+=127){ctx.bezierCurveTo(x+21,1210,x+42,1226,x+63.5,1226);ctx.bezierCurveTo(x+85,1226,x+106,1210,x+127,1210);}ctx.stroke();
 star(ctx,72,1250,30,p.accent);ctx.fillStyle=p.sub;ctx.font='500 25px "Helvetica Neue", Arial, sans-serif';ctx.fillText('memorate.',112,1274);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not generate image.')),'image/png'));
}
