import type { Category, Note } from './models.ts';
const CYRILLIC: Record<string,string> = {а:'a',б:'b',в:'v',г:'g',ґ:'g',д:'d',е:'e',є:'ye',ё:'yo',ж:'zh',з:'z',и:'i',і:'i',ї:'yi',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
export const normalizeSearch = (value:string) => Array.from(value.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu,''),c=>CYRILLIC[c]??c).join('').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
// Bounded optimal-string-alignment distance also recognizes swapped letters.
function distance(a:string,b:string,max:number):number {
 if(Math.abs(a.length-b.length)>max)return max+1;
 let previous=Array.from({length:b.length+1},(_,i)=>i),before=previous;
 for(let i=1;i<=a.length;i++) {const row=[i];for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],before[j-2]+1);}before=previous;previous=row;if(Math.min(...row)>max)return max+1;}return previous[b.length];
}
type Field={text:string;words:string[];weight:number};
const cache=new WeakMap<Note,{category:string;fields:Field[]}>();
function fields(note:Note,category:string):Field[]{
 const old=cache.get(note);if(old?.category===category)return old.fields;
 const info=note.productInfo;
 const metadata=info?Object.entries(info).filter(([key])=>!['brand','barcode','sources'].includes(key)).flatMap(([,v])=>Array.isArray(v)?v.map(n=>typeof n==='object'?`${n.name} ${n.value}`:n):[v]).join(' '):'';
 const values:[[string,number],[string,number],[string,number],[string,number],[string,number]]=[[note.title,700],[info?.brand||'',500],[category,350],[note.comment,200],[metadata,180]];
 const result=values.map(([value,weight])=>{const text=normalizeSearch(value);return {text,words:text.split(' '),weight};});cache.set(note,{category,fields:result});return result;
}
export function scoreNote(note:Note,categories:Category[],query:string):number {
 const normalized=normalizeSearch(query);if(!normalized)return query.trim()?0:1;
 const terms=normalized.split(' '),data=fields(note,categories.find(c=>c.id===note.categoryId)?.name||'Uncategorized');
 if(data[0].text===normalized)return 10000;
 const barcode=note.barcode||note.productInfo?.barcode||'';
 let total=0;
 for(const term of terms){let best=0;if(/^\d{4,}$/.test(term)&&barcode.includes(term))best=600;
 for(const field of data){if(field.text.includes(term)){best=Math.max(best,field.weight+50);continue;}
 // No fuzzy matching for short fragments, numbers or long pasted strings.
 const max=/\d/.test(term)||term.length<4||term.length>40?0:term.length>=8?2:1;
 if(max&&field.words.some(word=>word.length>=term.length-max&&word.length<=term.length+max&&distance(term,word,max)<=max))best=Math.max(best,field.weight-80);
 }if(!best)return 0;total+=best;}
 return total/terms.length+(data[0].text.startsWith(normalized)?100:0);
}
export const matchesNote=(note:Note,categories:Category[],query:string)=>scoreNote(note,categories,query)>0;
