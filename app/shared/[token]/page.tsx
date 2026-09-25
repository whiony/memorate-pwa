import {notFound} from 'next/navigation';
import {readPublicNote} from '@/lib/server/shares';
import {ApiError} from '@/lib/server/api';
import {PublicNoteView} from '@/components/public-note-view';
export const dynamic='force-dynamic';
export const metadata={title:'A note · Memorate',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function SharedPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const result=await readPublicNote(token).then(note=>({note,error:null})).catch((error:unknown)=>({note:null,error}));
 if(result.note)return <PublicNoteView note={result.note} token={token}/>;
 const missing=result.error instanceof ApiError&&result.error.status===404;
 if(missing)notFound();
 console.error('Shared note unavailable');
 return <main className="public-note-page"><div className="public-unavailable"><h1>{missing?'This link is no longer available':'Unable to load this note'}</h1><p>{missing?'The link may have been revoked or is incorrect.':'Please try again later.'}</p><span className="wordmark">memorate.</span></div></main>;
}
