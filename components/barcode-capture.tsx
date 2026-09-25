"use client";
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Camera, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { normalizeBarcode } from '@/lib/barcode';
import { productPhoto } from '@/lib/product-photo';
import type { Note, Photo } from '@/lib/models';
import type { IScannerControls } from '@zxing/browser';
export type ProductDraft={barcode:string;name?:string;source?:string;photo?:Photo;message?:string};
export function BarcodeCapture({notes,onUse,onExisting,onClose}:{notes:Note[];onUse:(draft:ProductDraft)=>void;onExisting:(note:Note)=>void;onClose:()=>void}) {
 const closeButton=useRef<HTMLButtonElement>(null);
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),controls=useRef<IScannerControls|null>(null),generation=useRef(0),abort=useRef<AbortController|null>(null);
 const [notFound,setNotFound]=useState(false);
 const [format,setFormat]=useState('auto');
 const [code,setCode]=useState(''),[camera,setCamera]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[duplicate,setDuplicate]=useState<Note|null>(null);
 const stop=()=>{generation.current++;controls.current?.stop();controls.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;};
 useEffect(()=>{const hide=()=>{stop();setCamera(false);};const visibility=()=>{if(document.hidden)hide();};document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',hide);return()=>{stop();abort.current?.abort();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',hide);};},[]);
 const close=()=>{stop();abort.current?.abort();onClose();};
 async function lookup(input:string,skipDuplicate=false) {
  const barcode=normalizeBarcode(input,format);if(!barcode){setError('Enter a valid EAN, UPC or GTIN barcode, including its check digit.');return;}
  stop();setCamera(false);setCode(barcode);setFormat('auto');setError('');setNotFound(false);
  const found=notes.find(n=>n.barcode&&normalizeBarcode(n.barcode)===barcode);
  if(found&&!skipDuplicate){setDuplicate(found);return;}
  setDuplicate(null);setBusy(true);abort.current?.abort();const controller=new AbortController();abort.current=controller;
  try {const response=await fetch(`/api/products/${barcode}`,{signal:controller.signal});if(!response.ok)throw new Error(response.status===429?'Product search is busy. Try again shortly or continue manually.':'Product search is unavailable. Try again or continue manually.');const {product}=z.object({product:z.object({barcode:z.string(),name:z.string().max(160),source:z.enum(["open-food-facts","open-beauty-facts","open-pet-food-facts","open-products-facts","upcitemdb"]),hasImage:z.boolean()}).nullable()}).parse(await response.json());
   if(!product){setNotFound(true);return;}
   let photo:Photo|undefined;let message:string|undefined;
   if(product.hasImage)try{photo=await productPhoto(barcode,controller.signal);}catch{message='Product found, but its photo could not be downloaded. You can add your own.';}
   if(!controller.signal.aborted)onUse({barcode,name:product.name,source:product.source,photo,message});
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error && error.message.startsWith('Product search')?error.message:'Product search is unavailable. Try again or continue manually.');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 async function startCamera(){
  stop();setError('');setNotFound(false);setDuplicate(null);setCamera(true);const session=generation.current;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera unavailable');
   const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
   if(session!==generation.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;
   const [{BrowserMultiFormatReader},{BarcodeFormat,DecodeHintType}]=await Promise.all([import('@zxing/browser'),import('@zxing/library')]);
   if(session!==generation.current)return;
   const hints=new Map([[DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E,BarcodeFormat.ITF]]]);
   const reader=new BrowserMultiFormatReader(hints,{delayBetweenScanAttempts:120,delayBetweenScanSuccess:500});
   const scanner=await reader.decodeFromStream(media,video.current!,result=>{if(result&&session===generation.current){const value=normalizeBarcode(result.getText(),BarcodeFormat[result.getBarcodeFormat()]);if(value)void lookup(value);}});
   if(session!==generation.current)scanner.stop();else controls.current=scanner;
  }catch(e){if(session===generation.current){stop();setCamera(false);setError(e instanceof DOMException&&e.name==='NotAllowedError'?'Camera access was denied. Allow it in your browser settings, or enter the barcode below.':'Camera is unavailable. You can enter the barcode below.');}}
 }
 return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="barcode-dialog" showCloseButton={false} onOpenAutoFocus={e=>{e.preventDefault();closeButton.current?.focus({preventScroll:true});}}><div className="scanner-heading"><DialogTitle>Scan barcode</DialogTitle><button type="button" ref={closeButton} className="icon-button" onClick={close} aria-label="Close scanner"><X/></button></div><DialogDescription>Scan a product or enter the number on its packaging.</DialogDescription>
  <div className={`scanner-camera ${camera?'is-active':''}`}><video ref={video} muted playsInline aria-label="Barcode camera preview"/>{camera?<><span className="scanner-guide" aria-hidden="true"/><p>Keep the barcode inside the frame</p><button type="button" className="secondary-button" onClick={()=>{stop();setCamera(false);}}>Stop camera</button></>:<button type="button" className="secondary-button" disabled={busy} onClick={startCamera}><Camera size={18}/> Start camera</button>}</div>
  <form onSubmit={e=>{e.preventDefault();void lookup(code);}}><label className="field-label" htmlFor="barcode-number">Barcode number</label><div className="barcode-entry"><input id="barcode-number" className="field-input" inputMode="numeric" autoComplete="off" maxLength={24} value={code} onChange={e=>{setCode(e.target.value);setDuplicate(null);setError('');setNotFound(false);}} disabled={busy}/><button className="primary-button" disabled={busy||!code.trim()}>{busy?'Looking…':'Find product'}</button></div>{code.replace(/[\s-]/g,'').length===8&&<label className="barcode-format">8-digit format<select className="field-input" value={format} onChange={e=>setFormat(e.target.value)}><option value="auto">Automatic (EAN-8 / UPC-E)</option><option value="UPC_E">UPC-E</option></select></label>}</form>
  {busy&&<p role="status">Looking up product…</p>}{error&&<p role="alert">{error}</p>}
  {notFound&&<div className="barcode-existing" role="status"><strong>Product not found</strong><p>You can still save this product with your own details.</p><button type="button" className="primary-button" onClick={()=>onUse({barcode:normalizeBarcode(code,format)||'',message:'Product not found. Add the details yourself.'})}>Enter product manually</button><button type="button" className="secondary-button" onClick={startCamera}>Scan again</button><button type="button" className="text-button" onClick={()=>{setNotFound(false);document.getElementById('barcode-number')?.focus();}}>Enter barcode manually</button></div>}
  {duplicate&&<div className="barcode-existing"><p>You’ve already added this product: <strong>{duplicate.title}</strong>.</p><button type="button" className="secondary-button" onClick={()=>{stop();onExisting(duplicate);}}>Open existing note</button><button type="button" className="text-button" onClick={()=>void lookup(code,true)}>Create another note</button></div>}
  {!duplicate&&!notFound&&<button type="button" className="text-button" disabled={busy} onClick={()=>{stop();onUse({barcode:normalizeBarcode(code,format)||''});}}>Continue manually</button>}
  <p className="product-attribution">Product data: <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Facts</a> (ODbL; its images CC BY-SA). Food, beauty, pet and general products. Additional results: <a href="https://www.upcitemdb.com" target="_blank" rel="noreferrer">UPCitemdb</a>.</p>
 </DialogContent></Dialog>;
}
