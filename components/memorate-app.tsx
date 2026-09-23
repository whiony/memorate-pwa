"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, Download, Ellipsis, Plus, Search, Settings2, SlidersHorizontal, Star, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Category, CATEGORY_COLORS, DEFAULT_PREFERENCES, Note, Photo, UserPreferences } from "@/lib/models";
import { repository } from "@/lib/repository";
import { matchesNote } from "@/lib/search";
import { newId } from "@/lib/id";

type SortKey = "newest" | "oldest" | "price-asc" | "price-desc" | "rating-desc" | "rating-asc";
type FilterState = { minRating: string; minPrice: string; maxPrice: string; from: string; to: string };
const EMPTY_FILTERS: FilterState = { minRating: "", minPrice: "", maxPrice: "", from: "", to: "" };
const CURRENCIES = ["EUR", "USD", "GBP", "UAH", "HRK", "PLN", "CHF", "JPY"];
const today = () => new Date().toLocaleDateString("en-CA");
const money = (price: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(price); }
  catch { return `${price} ${currency}`; }
};
const prettyDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function BrandStar({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d="M47.57,10.57 Q50,6 52.43,10.57 L61.63,27.84 Q63.52,31.39 67.48,32.09 L86.75,35.50 Q91.85,36.40 88.25,40.13 L74.67,54.21 Q71.87,57.11 72.43,61.10 L75.14,80.47 Q75.86,85.60 71.21,83.33 L53.62,74.76 Q50,73 46.38,74.76 L28.79,83.33 Q24.14,85.60 24.86,80.47 L27.57,61.10 Q28.13,57.11 25.33,54.21 L11.75,40.13 Q8.15,36.40 13.25,35.50 L32.52,32.09 Q36.48,31.39 38.37,27.84 Z" /></svg>;
}

function PhotoView({ blob, className = "", alt = "" }: { blob: Blob; className?: string; alt?: string }) {
  const [url, setUrl] = useState("");
  // The object URL is an external browser resource tied to this blob's lifetime.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url ? <img src={url} alt={alt} className={className} /> : <span className={`photo-loading ${className}`} />;
}

function Rating({ value, onChange, size = "normal" }: { value: number | null; onChange?: (value: number | null) => void; size?: "normal" | "large" }) {
  return <div className={`rating ${size === "large" ? "rating-large" : ""}`} aria-label={value ? `${value} out of 5 stars` : "Not rated"}>
    {[1, 2, 3, 4, 5].map(star => onChange ? <button key={star} type="button" className={star <= (value || 0) ? "filled" : ""} onClick={() => onChange(value === star ? null : star)} aria-label={`${star} star${star > 1 ? "s" : ""}`}><Star fill="currentColor" /></button> : <Star key={star} className={star <= (value || 0) ? "filled" : ""} fill="currentColor" />)}
  </div>;
}

function FieldSelect({ value, onChange, choices, label }: { value: string; onChange: (v: string) => void; choices: { value: string; label: string }[]; label: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="field-select" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{choices.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>;
}

function CropDialog({ file, onDone, onSkip }: { file: File | null; onDone: (blob: Blob) => void; onSkip: () => void }) {
  const [url, setUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  // A new file starts a new crop session and owns a fresh temporary URL.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!file) return; const next = URL.createObjectURL(file); setUrl(next); setZoom(1); setOffset({ x: 0, y: 0 }); setDimensions({ width: 1, height: 1 }); return () => URL.revokeObjectURL(next); }, [file]);
  const ratio = dimensions.width / dimensions.height;
  function bounded(x: number, y: number, level = zoom) {
    const size = frame.current?.clientWidth || 280;
    const maxX = Math.max(0, (Math.max(size, size * ratio) * level - size) / 2);
    const maxY = Math.max(0, (Math.max(size, size / ratio) * level - size) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }
  async function crop() {
    if (!url) return;
    setBusy(true);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 1000;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Unable to crop photo");
      const base = Math.max(1000 / image.width, 1000 / image.height) * zoom;
      const w = image.width * base, h = image.height * base;
      const frameSize = frame.current?.clientWidth || 280;
      ctx.drawImage(image, (1000 - w) / 2 + offset.x * 1000 / frameSize, (1000 - h) / 2 + offset.y * 1000 / frameSize, w, h);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Unable to save crop")), "image/jpeg", 0.88));
      onDone(blob);
    } catch { alert("This photo could not be cropped. Try another image."); }
    finally { setBusy(false); }
  }
  return <Dialog open={!!file} onOpenChange={open => { if (!open) onSkip(); }}><DialogContent className="crop-dialog" showCloseButton={false}><DialogHeader><DialogTitle>Adjust photo</DialogTitle><DialogDescription>Drag to position, then use the slider to zoom.</DialogDescription></DialogHeader>
    <div ref={frame} className="crop-frame" onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY, startX: offset.x, startY: offset.y }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (drag.current) setOffset(bounded(drag.current.startX + e.clientX - drag.current.x, drag.current.startY + e.clientY - drag.current.y)); }} onPointerUp={() => { drag.current = null; }}>
      {url && <img src={url} alt="Crop preview" draggable={false} onLoad={e => setDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} style={{ width: ratio >= 1 ? `${ratio * 100}%` : "100%", height: ratio >= 1 ? "100%" : `${100 / ratio}%`, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})` }} />}
      <span className="crop-guide" aria-hidden="true" />
    </div>
    <label className="range-label">Zoom <input type="range" min="1" max="2.5" step="0.01" value={zoom} onChange={e => { const next = Number(e.target.value); setZoom(next); setOffset(bounded(offset.x, offset.y, next)); }} /></label>
    <div className="dialog-actions"><button className="text-button" onClick={onSkip}>Skip photo</button><button className="primary-button" onClick={crop} disabled={busy}>{busy ? "Saving…" : "Use photo"}</button></div>
  </DialogContent></Dialog>;
}

function NoteEditor({ open, note, categories, currency, onClose, onSave, onAddCategory, onDelete }: {
  open: boolean; note: Note | null; categories: Category[]; currency: string; onClose: () => void;
  onSave: (note: Note) => Promise<void>; onAddCategory: (name: string) => Promise<Category | null>; onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(""); const [rating, setRating] = useState<number | null>(null); const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(today()); const [comment, setComment] = useState(""); const [price, setPrice] = useState(""); const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [photos, setPhotos] = useState<Photo[]>([]); const [queue, setQueue] = useState<File[]>([]); const [newCategory, setNewCategory] = useState(""); const [addingCategory, setAddingCategory] = useState(false); const [creatingCategory, setCreatingCategory] = useState(false); const [saving, setSaving] = useState(false);
  // Reset the draft when a different note is opened, without losing edits on prop refreshes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!open) return; setTitle(note?.title || ""); setRating(note?.rating ?? null); setCategoryId(note?.categoryId || ""); setDate(note?.date || today()); setComment(note?.comment || ""); setPrice(note?.price != null ? String(note.price) : ""); setSelectedCurrency(note?.currency || currency); setPhotos(note?.photos || []); setQueue([]); setNewCategory(""); setAddingCategory(false); }, [open, note, currency]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!title.trim() || saving || creatingCategory || queue.length) return;
    setSaving(true);
    const now = new Date().toISOString();
    try {
      await onSave({ id: note?.id || newId(), title: title.trim(), rating, categoryId: categoryId || null, date, comment: comment.trim(), price: price === "" ? null : Number(price), currency: selectedCurrency, photos, createdAt: note?.createdAt || now, updatedAt: now, syncState: "local" });
      onClose();
    } catch { /* The parent shows a storage error; keep the editor open. */ }
    finally { setSaving(false); }
  }
  async function addCategory() { if (!newCategory.trim() || creatingCategory) return; setCreatingCategory(true); try { const category = await onAddCategory(newCategory); if (category) { setCategoryId(category.id); setNewCategory(""); setAddingCategory(false); } } finally { setCreatingCategory(false); } }
  return <><Sheet open={open} onOpenChange={value => { if (!value) onClose(); }}><SheetContent side="right" showCloseButton={false} className="editor-sheet"><div className="sheet-top"><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button><SheetTitle>{note ? "Edit note" : "New note"}</SheetTitle><span className="sheet-top-spacer" /></div><SheetDescription className="sr-only">Save a memory with a title and optional details.</SheetDescription>
    <form id="note-form" onSubmit={save} className="editor-scroll"><label className="field-label" htmlFor="note-title">Title <span className="required">*</span></label><input id="note-title" className="title-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to remember?" required maxLength={160} autoFocus />
      <div className="editor-section"><div className="section-heading"><span>Photos</span><span className="optional">Optional</span></div><div className="photo-strip">{photos.map((photo, index) => <div className="photo-edit" key={photo.id}><PhotoView blob={photo.blob} alt={`Photo ${index + 1}`} /><button type="button" className="photo-remove" onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))} aria-label={`Remove photo ${index + 1}`}><X size={14} /></button><div className="photo-move">{index > 0 && <button type="button" onClick={() => setPhotos(prev => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} aria-label="Move photo left"><ArrowLeft size={15} /></button>}{index < photos.length - 1 && <button type="button" onClick={() => setPhotos(prev => { const next = [...prev]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} aria-label="Move photo right"><ChevronRight size={15} /></button>}</div></div>)}<label className="add-photo"><input className="file-hit-target" type="file" accept="image/*" multiple aria-label="Add photos" onChange={e => { setQueue(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ""; }} /><Camera size={22} /><span>Add photos</span></label></div></div>
      <div className="editor-section"><div className="section-heading">Your rating</div><Rating value={rating} onChange={setRating} size="large" /></div>
      <div className="form-grid"><div className="form-field"><label className="field-label" htmlFor="note-category">Category</label><select id="note-category" className="field-input category-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">No category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className="inline-link" onClick={() => setAddingCategory(!addingCategory)}><Plus size={15} /> New category</button></div><div className="form-field"><label className="field-label" htmlFor="note-date">Date</label><input id="note-date" type="date" className="field-input" value={date} onChange={e => setDate(e.target.value)} required /></div></div>
      {addingCategory && <div className="inline-create"><input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Category name" maxLength={32} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} aria-label="New category name" /><button type="button" onClick={addCategory} disabled={!newCategory.trim() || creatingCategory}>{creatingCategory ? "Adding…" : "Add"}</button></div>}
      <div className="editor-section"><label className="field-label" htmlFor="note-comment">Comment</label><textarea id="note-comment" className="field-input comment-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="What did you think? Anything to remember next time?" rows={4} /></div>
      <div className="editor-section"><label className="field-label" htmlFor="note-price">Price</label><div className="price-input"><input id="note-price" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} /><FieldSelect label="Currency" value={selectedCurrency} onChange={setSelectedCurrency} choices={CURRENCIES.map(c => ({ value: c, label: c }))} /></div></div>
      {note && <button type="button" className="danger-link" onClick={() => onDelete(note.id)}><Trash2 size={17} /> Delete note</button>}
    </form><div className="editor-footer"><button type="submit" form="note-form" className="primary-button full" disabled={!title.trim() || saving || creatingCategory || queue.length > 0}>{saving ? "Saving…" : note ? "Save changes" : "Save note"}</button></div>
  </SheetContent></Sheet><CropDialog file={queue[0] || null} onDone={blob => { setPhotos(prev => [...prev, { id: newId(), blob }]); setQueue(prev => prev.slice(1)); }} onSkip={() => setQueue(prev => prev.slice(1))} /></>;
}

function NoteCard({ note, category, onOpen }: { note: Note; category?: Category; onOpen: () => void }) {
  return <button className="note-card" onClick={onOpen} type="button"><div className="note-card-content"><div className="card-top"><span className="category-label"><span className="category-mark" style={{ background: category?.color || "#BCA9A2" }} />{category?.name || "Uncategorized"}</span><span className="card-date">{prettyDate(note.date)}</span></div><h2>{note.title}</h2>{note.comment && <p className="card-preview">{note.comment}</p>}<div className="card-bottom"><span className={`numeric-rating ${note.rating ? "" : "unrated"}`}>{note.rating ? <>{note.rating.toFixed(1)} <BrandStar className="rating-mark" /></> : "Not rated"}</span>{note.price != null && <span className="card-price">{money(note.price, note.currency)}</span>}</div></div>{note.photos[0] && <PhotoView blob={note.photos[0].blob} className="card-photo" alt="" />}</button>;
}

function Detail({ note, category, onBack, onEdit, onDelete }: { note: Note; category?: Category; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0); const [zoom, setZoom] = useState(false); const [menu, setMenu] = useState(false);
  // Navigating to another note resets its gallery and action menu.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPhotoIndex(0); setMenu(false); }, [note.id]);
  return <div className="detail-view"><div className="detail-nav"><button className="back-button" onClick={onBack}><ArrowLeft size={19} /> All notes</button><div className="menu-wrap"><button className="icon-button" onClick={() => setMenu(!menu)} aria-label="Note actions" aria-expanded={menu}><Ellipsis /></button>{menu && <div className="action-menu"><button onClick={() => { setMenu(false); onEdit(); }}>Edit note</button><button className="danger" onClick={() => { setMenu(false); onDelete(); }}>Delete note</button></div>}</div></div>
    <div className="detail-layout">{note.photos.length > 0 && <div className="detail-gallery"><button className="gallery-image" onClick={() => setZoom(true)} aria-label="Expand photo"><PhotoView blob={note.photos[photoIndex].blob} alt={`${note.title}, photo ${photoIndex + 1}`} /></button>{note.photos.length > 1 && <div className="gallery-controls"><button onClick={() => setPhotoIndex((photoIndex - 1 + note.photos.length) % note.photos.length)} aria-label="Previous photo"><ChevronLeft /></button><span>{photoIndex + 1} / {note.photos.length}</span><button onClick={() => setPhotoIndex((photoIndex + 1) % note.photos.length)} aria-label="Next photo"><ChevronRight /></button></div>}</div>}
      <div className="detail-copy"><span className="category-label"><span className="category-mark" style={{ background: category?.color || "#CBD0D3" }} />{category?.name || "Uncategorized"}</span><h1>{note.title}</h1><div className="detail-rating"><Rating value={note.rating} size="large" />{note.rating && <span>{note.rating} / 5</span>}</div><div className="detail-facts"><div><span>Date</span><strong>{prettyDate(note.date)}</strong></div>{note.price != null && <div><span>Price</span><strong>{money(note.price, note.currency)}</strong></div>}</div>{note.comment && <div className="detail-comment"><h2>Your note</h2><p>{note.comment}</p></div>}</div></div>
    <Dialog open={zoom} onOpenChange={setZoom}><DialogContent className="zoom-dialog" showCloseButton={false}><DialogTitle className="sr-only">Expanded photo</DialogTitle><DialogDescription className="sr-only">Photo from {note.title}</DialogDescription><button className="zoom-close" onClick={() => setZoom(false)} aria-label="Close photo"><X /></button>{note.photos[photoIndex] && <PhotoView blob={note.photos[photoIndex].blob} alt={`${note.title}, photo ${photoIndex + 1}`} />}</DialogContent></Dialog>
  </div>;
}

export default function MemorateApp() {
  const [notes, setNotes] = useState<Note[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [category, setCategory] = useState("all"); const [sort, setSort] = useState<SortKey>("newest"); const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false); const [editorOpen, setEditorOpen] = useState(false); const [editing, setEditing] = useState<Note | null>(null); const [selectedId, setSelectedId] = useState<string | null>(null); const [settings, setSettings] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null); const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null); const [categoryName, setCategoryName] = useState(""); const [notice, setNotice] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const reload = useCallback(async () => { setNotes(await repository.notes()); setCategories(await repository.categories()); }, []);
  useEffect(() => { repository.initialize().then(data => { setNotes(data.notes); setCategories(data.categories); setPreferences(data.preferences); }).catch(() => setError("Memorate could not open local storage. Check your browser settings and reload." )).finally(() => setLoading(false)); }, []);
  useEffect(() => { const theme = preferences.theme; document.documentElement.dataset.theme = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme; const media = matchMedia("(prefers-color-scheme: dark)"); const update = () => { if (theme === "system") document.documentElement.dataset.theme = media.matches ? "dark" : "light"; }; media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, [preferences.theme]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(async () => {
      const registration = await navigator.serviceWorker.ready;
      const assets = performance.getEntriesByType("resource").map(entry => entry.name).filter(url => url.startsWith(location.origin));
      (navigator.serviceWorker.controller || registration.active)?.postMessage({ type: "PRECACHE", assets });
    }).catch(() => {});
  }, []);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(id); }, [notice]);
  const selected = notes.find(n => n.id === selectedId);
  const filtered = useMemo(() => {
    const list = notes.filter(note => {
      if (category !== "all" && note.categoryId !== (category === "none" ? null : category)) return false;
      if (!matchesNote(note, categories, query)) return false;
      if (filters.minRating && (note.rating || 0) < Number(filters.minRating)) return false;
      if (filters.minPrice && (note.price == null || note.price < Number(filters.minPrice))) return false;
      if (filters.maxPrice && (note.price == null || note.price > Number(filters.maxPrice))) return false;
      if (filters.from && note.date < filters.from) return false;
      if (filters.to && note.date > filters.to) return false;
      return true;
    });
    return list.sort((a, b) => { switch (sort) { case "oldest": return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt); case "price-asc": return (a.price ?? Infinity) - (b.price ?? Infinity); case "price-desc": return (b.price ?? -Infinity) - (a.price ?? -Infinity); case "rating-desc": return (b.rating ?? -1) - (a.rating ?? -1); case "rating-asc": return (a.rating ?? 6) - (b.rating ?? 6); default: return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt); } });
  }, [notes, categories, query, category, filters, sort]);
  const activeFilters = Object.values(filters).filter(Boolean).length + (sort !== "newest" ? 1 : 0);
  async function saveNote(note: Note) { try { await repository.saveNote(note); await reload(); setSelectedId(note.id); setSettings(false); setNotice(editing ? "Changes saved" : "Note saved"); } catch { setNotice("Could not save. Check available device storage."); throw new Error("Save failed"); } }
  async function addCategory(name: string): Promise<Category | null> { const trimmed = name.trim(); if (!trimmed) return null; const existing = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase()); if (existing) return existing; const item = { id: newId(), name: trimmed, color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length], createdAt: new Date().toISOString() }; try { await repository.saveCategory(item); await reload(); return item; } catch { setNotice("Could not save category"); return null; } }
  async function removeNote() { if (!deleteId) return; try { await repository.deleteNote(deleteId); await reload(); setSelectedId(null); setEditorOpen(false); setDeleteId(null); setNotice("Note deleted"); } catch { setNotice("Could not delete note"); } }
  async function removeCategory() { if (!deleteCategoryId) return; try { await repository.deleteCategory(deleteCategoryId); await reload(); if (category === deleteCategoryId) setCategory("all"); setDeleteCategoryId(null); setNotice("Category deleted; its notes are uncategorized"); } catch { setNotice("Could not delete category"); } }
  async function updatePrefs(next: UserPreferences) { try { await repository.savePreferences(next); setPreferences(next); } catch { setNotice("Could not save preference"); } }
  async function exportData() { try { const data = await Promise.all(notes.map(async note => ({ ...note, photos: await Promise.all(note.photos.map(async photo => ({ id: photo.id, type: photo.blob.type, data: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(photo.blob); }) }))) }))); const file = new Blob([JSON.stringify({ format: "memorate-export", version: 1, exportedAt: new Date().toISOString(), notes: data, categories, preferences }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(file); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `memorate-${today()}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch { setNotice("Could not create export"); } }
  if (loading) return <main className="app-shell loading-state"><span className="wordmark">memorate<span>.</span></span><p>Opening your collection…</p></main>;
  if (error) return <main className="app-shell loading-state"><span className="wordmark">memorate<span>.</span></span><p>{error}</p><button className="primary-button" onClick={() => location.reload()}>Reload</button></main>;
  return <div className="app-shell"><div className="app-container"><header className="app-header"><button className="brand" onClick={() => { setSelectedId(null); setSettings(false); }} aria-label="Memorate home"><BrandStar className="brand-symbol" /><span className="wordmark">memorate<span>.</span></span></button><button className={`icon-button settings-button ${settings ? "active" : ""}`} onClick={() => { setSettings(!settings); setSelectedId(null); }} aria-label="Settings"><Settings2 size={20} /></button></header>
    {settings ? <main className="settings-view"><div className="screen-heading"><button className="back-button" onClick={() => setSettings(false)}><ArrowLeft size={19} /> Collection</button><h1>Settings</h1></div><section className="settings-section"><h2>Appearance</h2><div className="setting-row"><div><strong>Theme</strong><p>Choose how Memorate looks.</p></div><FieldSelect label="Theme" value={preferences.theme} onChange={v => updatePrefs({ ...preferences, theme: v as UserPreferences["theme"] })} choices={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "amoled", label: "AMOLED" }]} /></div><div className="setting-row"><div><strong>Default currency</strong><p>Used for new notes.</p></div><FieldSelect label="Default currency" value={preferences.defaultCurrency} onChange={v => updatePrefs({ ...preferences, defaultCurrency: v })} choices={CURRENCIES.map(c => ({ value: c, label: c }))} /></div></section>
      <section className="settings-section"><h2>Categories</h2><p className="section-note">Give your collection its own labels.</p><div className="category-settings">{categories.map(item => <div className="category-row" key={item.id}><span className="category-mark" style={{ background: item.color }} /><input aria-label={`Rename ${item.name}`} value={item.name} maxLength={32} onChange={e => setCategories(prev => prev.map(c => c.id === item.id ? { ...c, name: e.target.value } : c))} onBlur={async e => { const value = e.target.value.trim(); if (value) { await repository.saveCategory({ ...item, name: value }); await reload(); } else await reload(); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /><button className="icon-button small" onClick={() => setDeleteCategoryId(item.id)} aria-label={`Delete ${item.name}`}><Trash2 size={18} /></button></div>)}<div className="inline-create settings-create"><input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="New category" maxLength={32} aria-label="New category" onKeyDown={async e => { if (e.key === "Enter") { await addCategory(categoryName); setCategoryName(""); } }} /><button onClick={async () => { if (await addCategory(categoryName)) setCategoryName(""); }} disabled={!categoryName.trim()}>Add</button></div></div></section>
      <section className="settings-section"><h2>Your data</h2><p className="section-note">Your notes and photos are stored in this browser on this device. They are not sent to a server. Export a backup before clearing browser data or changing devices.</p><button className="secondary-button export-button" onClick={exportData}><Download size={18} /> Export backup (.json)</button></section><section className="settings-section muted-section"><h2>Account & sync</h2><p>Cloud backup and syncing between devices are planned. This version works locally without an account.</p></section><p className="version">Memorate · Version 1.0</p></main> : selected ? <Detail note={selected} category={categories.find(c => c.id === selected.categoryId)} onBack={() => setSelectedId(null)} onEdit={() => { setEditing(selected); setEditorOpen(true); }} onDelete={() => setDeleteId(selected.id)} /> : <main className="home-view"><div className="home-heading"><div><p className="eyebrow">YOUR PERSONAL CATALOG</p><h1>All notes <span className="count">{notes.length}</span></h1></div><button className="desktop-add primary-button" onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={20} /> New note</button></div>
      <div className="search-row"><div className="search-box"><Search size={20} /><input ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search what you tried…" aria-label="Search notes" />{query && <button onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear search"><X size={17} /></button>}</div><button className={`filter-button ${activeFilters ? "is-filtered" : ""}`} onClick={() => setFilterOpen(true)} aria-label={`Filters and sort${activeFilters ? `, ${activeFilters} active` : ""}`}><SlidersHorizontal size={20} /><span>Filter{activeFilters ? ` · ${activeFilters}` : ""}</span></button></div>
      <div className="category-strip" role="group" aria-label="Filter by category"><button className={`category-chip ${category === "all" ? "selected" : ""}`} onClick={() => setCategory("all")}>All</button>{categories.map(item => <button key={item.id} className={`category-chip ${category === item.id ? "selected" : ""}`} onClick={() => setCategory(item.id)}><span className="category-mark" style={{ background: item.color }} />{item.name}</button>)}{notes.some(n => !n.categoryId) && <button className={`category-chip ${category === "none" ? "selected" : ""}`} onClick={() => setCategory("none")}>Uncategorized</button>}</div>
      {notes.length === 0 ? <div className="empty-state first-empty"><div className="empty-icon"><BrandStar /></div><h2>Remember the little things.</h2><p>Keep track of things you try, so you don’t have to remember them.</p><button className="primary-button" onClick={() => { setEditing(null); setEditorOpen(true); }}>Add your first note <Plus size={18} /></button></div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><Search size={27} strokeWidth={1.5} /></div><h2>Nothing found yet</h2><p>{query ? "Try a different spelling or a shorter search." : "No notes match these filters."}</p><button className="text-button" onClick={() => { setQuery(""); setCategory("all"); setFilters(EMPTY_FILTERS); setSort("newest"); }}>Clear search & filters</button></div> : <><div className="result-line"><span>{filtered.length} {filtered.length === 1 ? "note" : "notes"}</span><span>{sort === "newest" ? "Newest first" : { oldest: "Oldest first", "price-asc": "Price: low to high", "price-desc": "Price: high to low", "rating-desc": "Top rated", "rating-asc": "Lowest rated" }[sort]}</span></div><div className="notes-grid">{filtered.map(note => <NoteCard key={note.id} note={note} category={categories.find(c => c.id === note.categoryId)} onOpen={() => setSelectedId(note.id)} />)}</div></>}
    </main>}
  </div>{!settings && !selected && <button className="mobile-fab" onClick={() => { setEditing(null); setEditorOpen(true); }} aria-label="Add note"><Plus size={28} strokeWidth={2} /></button>}
  <Sheet open={filterOpen} onOpenChange={setFilterOpen}><SheetContent side="bottom" className="filter-sheet" showCloseButton={false}><div className="sheet-top"><SheetTitle>Filter & sort</SheetTitle><button className="icon-button" onClick={() => setFilterOpen(false)} aria-label="Close filters"><X /></button></div><SheetDescription className="sr-only">Choose sorting, rating, price and date filters.</SheetDescription><div className="filter-scroll"><label className="field-label">Sort by</label><FieldSelect label="Sort by" value={sort} onChange={v => setSort(v as SortKey)} choices={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "price-asc", label: "Price: low to high" }, { value: "price-desc", label: "Price: high to low" }, { value: "rating-desc", label: "Rating: high to low" }, { value: "rating-asc", label: "Rating: low to high" }]} /><label className="field-label">Minimum rating</label><FieldSelect label="Minimum rating" value={filters.minRating || "any"} onChange={v => setFilters(f => ({ ...f, minRating: v === "any" ? "" : v }))} choices={[{ value: "any", label: "Any rating" }, ...[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n}+ stars` }))]} /><label className="field-label">Price range</label><div className="filter-pair"><input className="field-input" type="number" min="0" inputMode="decimal" placeholder="Min" aria-label="Minimum price" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} /><input className="field-input" type="number" min="0" inputMode="decimal" placeholder="Max" aria-label="Maximum price" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} /></div><label className="field-label">Date range</label><div className="filter-pair"><input className="field-input" type="date" aria-label="From date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} /><input className="field-input" type="date" aria-label="To date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} /></div></div><div className="filter-footer"><button className="text-button" onClick={() => { setFilters(EMPTY_FILTERS); setSort("newest"); }}>Reset</button><button className="primary-button" onClick={() => setFilterOpen(false)}>Show {filtered.length} {filtered.length === 1 ? "note" : "notes"}</button></div></SheetContent></Sheet>
  <NoteEditor open={editorOpen} note={editing} categories={categories} currency={preferences.defaultCurrency} onClose={() => setEditorOpen(false)} onSave={saveNote} onAddCategory={addCategory} onDelete={setDeleteId} />
  <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this note?</AlertDialogTitle><AlertDialogDescription>This removes the note and its photos from this device. It can’t be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep note</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={removeNote}>Delete note</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  <AlertDialog open={!!deleteCategoryId} onOpenChange={open => { if (!open) setDeleteCategoryId(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete category?</AlertDialogTitle><AlertDialogDescription>Notes in this category will stay in your collection as uncategorized.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={removeCategory}>Delete category</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}
