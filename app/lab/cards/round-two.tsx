"use client";
import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { INITIAL_CATEGORIES } from "@/lib/models";
import s from "./round-two.module.css";
function BrandStar({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d="M47.57,10.57 Q50,6 52.43,10.57 L61.63,27.84 Q63.52,31.39 67.48,32.09 L86.75,35.50 Q91.85,36.40 88.25,40.13 L74.67,54.21 Q71.87,57.11 72.43,61.10 L75.14,80.47 Q75.86,85.60 71.21,83.33 L53.62,74.76 Q50,73 46.38,74.76 L28.79,83.33 Q24.14,85.60 24.86,80.47 L27.57,61.10 Q28.13,57.11 25.33,54.21 L11.75,40.13 Q8.15,36.40 13.25,35.50 L32.52,32.09 Q36.48,31.39 38.37,27.84 Z" /></svg>;
}


type Note = { id: string; title: string; comment: string; rating: number; category: string; date: string; price: string; photos: string[] };
const notes: Note[] = [
 { id:"01", title:"Coffee break", comment:"Flaky, still warm. The tiny table by the window is the best one.", rating:4.5, category:"food", date:"Sep 24, 2026", price:"€3.20", photos:["cafe"] },
 { id:"02", title:"The impossibly soft oversized cardigan I kept thinking about all winter", comment:"Beautiful texture. Sleeves a little too long, but I wore it all weekend.", rating:4, category:"clothes", date:"December 31, 2026", price:"€189.00", photos:["cardigan"] },
 { id:"03", title:"Hand cream", comment:"", rating:2, category:"beauty", date:"Jan 3, 2026", price:"€4.80", photos:["cream"] },
 { id:"04", title:"A weekend, unplanned", comment:"Sea air, a coffee stop, and nowhere we needed to be.", rating:5, category:"places", date:"May 1, 2026", price:"€248.00", photos:["coast","cafe","cardigan","cream","coast"] },
 { id:"05", title:"Место, куда хочется вернуться", comment:"Тихий берег, ветер и кофе по дороге. Сохраню этот день.", rating:4.5, category:"places", date:"Sep 18, 2026", price:"€12.50", photos:["coast"] },
 { id:"06", title:"A little renovation", comment:"Finally made the reading corner ours. Including the chair, paint and shelves.", rating:4, category:"other", date:"September 24, 2026", price:"€12,450.99", photos:["cardigan"] },
 { id:"07", title:"Not again", comment:"Too sweet. Looked better than it tasted.", rating:1.5, category:"food", date:"Jun 2, 2026", price:"€0.80", photos:["cafe","cream"] },
 { id:"08", title:"Just a thought", comment:"No photo this time. A small reminder to take the slower route home.", rating:3.5, category:"other", date:"Feb 28, 2026", price:"—", photos:[] },
];
const concepts = [
 {id:"wave",name:"Wave Shelf",note:"A warm lower layer covers the photograph. One broad curve, three amplitudes.",options:["Subtle","Medium","Expressive"]},
 {id:"stack",name:"Photo Stack",note:"A dominant print with a few loose photographs tucked behind it."},
 {id:"gallery",name:"Gallery + Caption",note:"Image first. A compact caption keeps the memory close."},
 {id:"drawer",name:"Drawer List",note:"Scan the titles. Open a row to reveal its comment and the rest of its photographs."},
 {id:"featured",name:"Split Grid / Featured Item",note:"One selected memory gets more room, within an ordered grid."},
 {id:"cut",name:"Cut-Paper Split",note:"Two overlapping surfaces, joined by a broad curved edge."},
 {id:"folder",name:"Archive Folder",note:"A small category tab gives the collection a personal archive silhouette."},
 {id:"mounted",name:"Mounted Print",note:"A photograph set into warm paper, with a small offset caption."},
 {id:"label",name:"Label on Photo",note:"An opaque paper caption sits over the image, in three positions.",options:["Lower left","Lower center","Side overlap"]},
 {id:"sidecar",name:"Sidecar",note:"A quiet information rail gives every detail a predictable place.",options:["Left rail","Right rail"]},
 {id:"contact",name:"Contact Sheet",note:"One main frame and a short strip from the same personal photo roll."},
 {id:"poster",name:"Soft Poster",note:"A strong title leads a restrained photographic composition."},
 {id:"referenceWave",name:"Wave Card",note:"Reference study: a generous text area, an edge photograph and a repeating wave of warm paper across both."},
 {id:"referenceFolder",name:"Wave Card + Category Tab",note:"The same wave composition, with the category on a connected folder tab."},
 {id:"circleWave",name:"Wave Card + Circular Photo",note:"A round photograph, vertically centered above the wave at every card height."},
 {id:"circleWaveDense",name:"Wave Card + Circular Photo — Dense Wave",note:"The same centered photograph, with a shorter, more frequent wave."},
];
const photoAlts:Record<string,string>={cafe:"A pastry and coffee at a cafe table",cream:"Hand cream on a bathroom sink",cardigan:"A cardigan on a chair at home",coast:"A casual photograph of a seaside promenade"};
function Photo({name}: {name:string}) { return <Image unoptimized src={`/card-lab/${name}.png`} alt={photoAlts[name]} width={1254} height={1254} loading="lazy" />; }
function Rating({note}:{note:Note}) {return <span className={s.rating} aria-label={`${note.rating} out of 5`}>{note.rating.toFixed(1)}<BrandStar /></span>;}
function Category({note}:{note:Note}) {const c=INITIAL_CATEGORIES.find(c=>c.id===note.category)!;return <span className={s.category}><i style={{background:c.color}} />{c.name}</span>;}
function Facts({note}:{note:Note}) {return <div className={s.facts}><span>{note.date}</span><span>{note.price}</span></div>;}
function Copy({note,category=true}:{note:Note;category?:boolean}) {return <div className={s.copy}>{category&&<Category note={note}/>}<h3 title={note.title}>{note.title}</h3><Rating note={note}/>{note.comment&&<p className={s.comment}>{note.comment}</p>}</div>;}
function Media({note,kind}:{note:Note;kind:string}) {
 if(!note.photos.length)return null;
 const multiple=note.photos.length>1;
 const limit=kind==="stack"?3:kind==="contact"?4:kind==="gallery"?3:1;
 return <div className={`${s.media} ${s[kind+"Media"]||""} ${multiple?s.multiple:""}`} data-count={note.photos.length} aria-label={`${note.photos.length} photos`}>
 {note.photos.slice(0,limit).map((name,i)=><div className={s.frame} key={`${name}-${i}`}><Photo name={name}/></div>)}
 {note.photos.length>limit&&<span className={s.photoCount}>+{note.photos.length-limit}</span>}
 </div>;
}
function Drawer({note}:{note:Note}) {return <details className={s.drawerRow}><summary><span className={s.rowPhoto}>{note.photos.length?<Photo name={note.photos[0]}/>:<span className={s.textOnly}>Text note</span>}</span><span className={s.rowTitle}><Category note={note}/><span className={s.drawerTitle} title={note.title}>{note.title}</span><Rating note={note}/></span><span className={s.rowFacts}><Facts note={note}/></span><span className={s.reveal} aria-hidden="true">＋</span></summary><div className={s.drawerBody}><p>{note.comment||"No comment saved for this note."}</p><Facts note={note}/>{note.photos.length>1&&<div className={s.drawerPhotos}>{note.photos.slice(1).map((name,i)=><Photo key={i} name={name}/>)}</div>}</div></details>;}
function ReferenceWaveCard({note,folder,circular=false,dense=false}:{note:Note;folder:boolean;circular?:boolean;dense?:boolean}) {
 const waveId = useId();
 const wavePath = dense ? "M0 2 C7.33 2 14 10 21.33 10 C28.67 10 35.33 2 42.67 2" : "M0 2 C11 2 21 10 32 10 C43 10 53 2 64 2";
 return <article className={`${s.referenceWave} ${circular?s.referenceCircular:""} ${folder?s.referenceFolder:""} ${!note.photos.length?s.referenceTextOnly:""}`}>
  {folder&&<div className={s.referenceTab}><Category note={note}/></div>}
  <div className={s.referenceBody}>
   <div className={s.referenceCopy}>
    {!folder&&<Category note={note}/>}
    <h3 title={note.title}>{note.title}</h3><Rating note={note}/>
    {note.comment&&<p>{note.comment}</p>}
   </div>
   <Media note={note} kind="reference"/>
   <div className={s.referenceFooter}>
    <svg className={s.referenceWaveEdge} width="100%" height="14" aria-hidden="true">
     <defs><pattern id={waveId} width={dense?42.67:64} height="14" patternUnits="userSpaceOnUse">
      <path d={`${wavePath} V14 H0 Z`} fill="currentColor"/>
      <path d={wavePath} fill="none" stroke="var(--line)" strokeWidth="0.8"/>
     </pattern></defs><rect width="100%" height="14" fill={`url(#${waveId})`}/>
    </svg>
    <Facts note={note}/>
   </div>
  </div>
 </article>;
}
function Card({note,kind,option,index}:{note:Note;kind:string;option:number;index:number}) {
 if(kind==="circleWave"||kind==="circleWaveDense")return <ReferenceWaveCard note={note} folder={false} circular dense={kind==="circleWaveDense"}/>;
 if(kind==="referenceWave"||kind==="referenceFolder")return <ReferenceWaveCard note={note} folder={kind==="referenceFolder"}/>;
 if(kind==="drawer")return <Drawer note={note}/>;
 const mediaKind=kind==="featured"?"gallery":kind;
 return <article className={`${s.card} ${s[kind]} ${s[`option${option}`]} ${!note.photos.length?s.noPhoto:""} ${kind==="featured"&&index===0?s.hero:""}`}>
 {kind==="folder"&&<div className={s.tab}><Category note={note}/></div>}
 {kind==="poster"&&<div className={s.posterTitle}><h3 title={note.title}>{note.title}</h3><Rating note={note}/></div>}
 <Media note={note} kind={mediaKind}/>
 {kind==="sidecar"?<><div className={s.rail}><Category note={note}/><Rating note={note}/><Facts note={note}/></div><div className={s.copy}><h3 title={note.title}>{note.title}</h3>{note.comment&&<p className={s.comment}>{note.comment}</p>}</div></>:kind==="poster"?<div className={s.copy}><Category note={note}/>{note.comment&&<p className={s.comment}>{note.comment}</p>}</div>:<Copy note={note} category={kind!=="folder"&&kind!=="label"}/>}
 {kind!=="sidecar"&&<div className={s.shelf}>
 {kind==="wave"&&<svg className={s.waveEdge} viewBox="0 0 500 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 15 C100 -5 165 32 265 15 S420 0 500 12 L500 30 L0 30Z"/></svg>}
 {kind==="label"&&<Category note={note}/>}<Facts note={note}/></div>}
 </article>;
}
export default function RoundTwo(){
 const [width,setWidth]=useState("responsive");const [selection,setSelection]=useState("all");const [options,setOptions]=useState<Record<string,number>>({});
 return <main className={s.lab}><header className={s.header}><Link href="/" className={s.brand}><BrandStar/>memorate.</Link><Link href="/lab/cards/round-one">Round one ↗</Link></header>
 <div className={s.intro}><p className={s.eyebrow}>CARD LAB / ROUND TWO</p><h1>More photo.<br/>More personality.</h1><p>Sixteen different ways to keep a little moment.<br/>The same eight memories, through a different lens.</p></div>
 <div className={s.controls}><label>Explore<select value={selection} onChange={e=>setSelection(e.target.value)}><option value="all">All {concepts.length} concepts</option>{concepts.map((c,i)=><option key={c.id} value={c.id}>{String(i+1).padStart(2,"0")} · {c.name}</option>)}</select></label><fieldset><legend>Preview width</legend>{["responsive","mobile"].map(w=><button key={w} aria-pressed={width===w} onClick={()=>setWidth(w)}>{w==="responsive"?"Responsive":"Mobile · 390"}</button>)}</fieldset><span>8 mock notes · no live data</span></div>
 <div className={width==="mobile"?s.mobile:""}>{concepts.filter(c=>selection==="all"||c.id===selection).map(c=><section className={s.section} key={c.id} aria-labelledby={`concept-${c.id}`}><div className={s.heading}><span>{String(concepts.indexOf(c)+1).padStart(2,"0")}</span><div><h2 id={`concept-${c.id}`}>{c.name}</h2><p>{c.note}</p></div></div>{c.options&&<div className={s.options} role="group" aria-label={`${c.name} variations`}>{c.options.map((o,i)=><button aria-pressed={(options[c.id]||0)===i} key={o} onClick={()=>setOptions({...options,[c.id]:i})}>{o}</button>)}</div>}<div className={`${s.grid} ${s[c.id+"Grid"]||""}`}>{notes.map((note,i)=><Card key={note.id} note={note} kind={c.id} option={options[c.id]||0} index={i}/>)}</div></section>)}</div>
 <footer className={s.footer}>Design exploration only. Sample phone-style photographs generated with AI.<br/>Your real collection is unchanged. <Link href="/">Back to Memorate</Link></footer></main>;
}
