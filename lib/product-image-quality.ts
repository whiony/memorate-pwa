/** Header-only dimensions: no native image library is needed in the Worker. */
export function imageDimensions(bytes:Uint8Array):{width:number;height:number}|null {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>=24&&v.getUint32(0)===0x89504e47)return {width:v.getUint32(16),height:v.getUint32(20)};
 if(bytes.length>=12&&v.getUint16(0)===0xffd8) {
  let offset=2;
  while(offset+4<=bytes.length){if(bytes[offset++]!==255)return null;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===0xd9||marker===0xda)return null;if(marker===1||(marker>=0xd0&&marker<=0xd8))continue;if(offset+2>bytes.length)return null;const length=v.getUint16(offset);if(length<2||offset+length>bytes.length)return null;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7)return {height:v.getUint16(offset+3),width:v.getUint16(offset+5)};offset+=length;
  }
 }
 if(bytes.length>=30&&v.getUint32(0)===0x52494646&&v.getUint32(8)===0x57454250){
  const kind=new TextDecoder().decode(bytes.slice(12,16));
  if(kind==='VP8X')return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
  if(kind==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a)return {width:v.getUint16(26,true)&0x3fff,height:v.getUint16(28,true)&0x3fff};
  if(kind==='VP8L'&&bytes[20]===0x2f)return {width:1+bytes[21]+((bytes[22]&0x3f)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&0xf)<<10)};
 }
 return null;
}
export function usableDimensions(size:{width:number;height:number}|null):boolean {
 return !!size&&Math.min(size.width,size.height)>=80&&Math.max(size.width,size.height)>=300&&size.width*size.height<=25000000&&Math.max(size.width,size.height)/Math.min(size.width,size.height)<=7;
}
