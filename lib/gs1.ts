import { normalizeBarcode } from './barcode.ts';
export type ScannedCode={barcode:string;barcodeType:string;batchNumber?:string;expiryDate?:string};
function expiry(raw:string):string|undefined {
 if(!/^\d{6}$/.test(raw))return;
 const year=2000+Number(raw.slice(0,2)),month=Number(raw.slice(2,4)),day=Number(raw.slice(4));
 if(month<1||month>12)return;
 if(day===0)return `${year}-${raw.slice(2,4)}`; // Month-only expiry; do not invent a day.
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return;
 return date.toISOString().slice(0,10);
}
/** GS1 AIs are parsed locally. Batch/expiry never enter shared product caches or lookup URLs. */
export function parseProductCode(input:string,format?:string):ScannedCode|null {
 if(input.length>512)return null;
 const ordinary=normalizeBarcode(input,format);
 if(ordinary)return {barcode:ordinary,barcodeType:format&&format!=='auto'?format.replace(/_/g,'-'): (ordinary.length===14?'GTIN-14':ordinary.length===8?'EAN-8':'EAN-13 / UPC')};
 let raw=input.trim().replace(/^\]d2/,'').replace(/^\x1d/,'');
 const fields:Record<string,string>={};
 if(raw.startsWith('(')) {
  const parts=[...raw.matchAll(/\((\d{2,4})\)([^()]*)/g)];
  if(!parts.length||parts.map(p=>p[0]).join('')!==raw)return null;
  for(const [,ai,value] of parts){if(ai in fields)return null;fields[ai]=value.trim();}
 } else {
  const fixed:Record<string,number>={'00':18,'01':14,'02':14,'11':6,'15':6,'17':6,'20':2};
  const variable=new Set(['10','21','240','241','250']);
  while(raw){if(raw[0]==='\x1d'){raw=raw.slice(1);continue;}const ai=raw.startsWith('24')||raw.startsWith('250')?raw.slice(0,3):raw.slice(0,2);raw=raw.slice(ai.length);if(ai in fields)return null;
   if(fixed[ai]){const length=fixed[ai];if(raw.length<length)return null;fields[ai]=raw.slice(0,length);raw=raw.slice(length);}
   else if(variable.has(ai)){const end=raw.indexOf('\x1d');fields[ai]=end<0?raw:raw.slice(0,end);raw=end<0?'':raw.slice(end+1);if(!fields[ai]||fields[ai].length>(ai.length===2?20:30))return null;}
   else return null;
  }
 }
 if(!/^\d{14}$/.test(fields['01']||''))return null;
 const barcode=normalizeBarcode(fields['01']);if(!barcode)return null;
 const date=fields['17']?expiry(fields['17']):undefined;if(fields['17']&&!date)return null;
 if(fields['10']&&(!/^[\x20-\x7e]{1,20}$/.test(fields['10'])))return null;
 return {barcode,barcodeType:'GS1 DataMatrix',batchNumber:fields['10'],expiryDate:date};
}
