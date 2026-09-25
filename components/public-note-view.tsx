"use client";
/* eslint-disable @next/next/no-img-element -- Same-origin share photos. */
import {useState} from 'react';
import type {PublicNote} from '@/lib/public-note';
import {THEMES,themeTokens} from '@/lib/themes';
import {BrandStar} from './brand-star';
export function PublicNoteView({note,token}:{note:PublicNote;token:string}){
 const [index,setIndex]=useState(0);
 return <main className="public-note-page" style={themeTokens(THEMES['rose-sand'].palette) as React.CSSProperties}><article className={`public-note ${note.photoCount?'':'public-no-photo'}`}>{note.photoCount>0&&<div className="public-photo"><img src={`/api/shared/${token}/photos/${index}`} alt={`${note.title}, photo ${index+1}`} referrerPolicy="no-referrer"/>{note.photoCount>1&&<div className="public-photo-controls"><button onClick={()=>setIndex((index+note.photoCount-1)%note.photoCount)} aria-label="Previous photo">←</button><span>{index+1} / {note.photoCount}</span><button onClick={()=>setIndex((index+1)%note.photoCount)} aria-label="Next photo">→</button></div>}</div>}<div className="public-copy"><span className="category-label"><span className="category-mark" style={{background:note.categoryColor}}/>{note.category}</span><h1>{note.title}</h1>{note.rating!==null&&<div className="public-rating">{note.rating.toFixed(1)}<BrandStar/></div>}{note.comment&&<p className="public-comment">{note.comment}</p>}<div className="public-facts"><time dateTime={note.date}>{new Date(note.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</time>{note.price!==null&&<span>{new Intl.NumberFormat('en-GB',{style:'currency',currency:note.currency}).format(note.price)}</span>}</div></div></article><footer className="public-brand"><BrandStar/>Made with Memorate</footer></main>;
}
