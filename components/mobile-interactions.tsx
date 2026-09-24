"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function SwipeCard({ id, openId, setOpenId, onEdit, onDelete, children }: { id: string; openId: string | null; setOpenId: (id: string | null) => void; onEdit: () => void; onDelete: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; base: number; horizontal: boolean; vertical: boolean } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const suppress = useRef(false);
  const opened = openId === id;
  useEffect(() => {
    if (!opened) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpenId(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenId(null); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [opened, setOpenId]);
  return <div ref={root} className="swipe-card">
    <div className="swipe-actions" aria-hidden={!opened}><button tabIndex={opened ? 0 : -1} onClick={() => { setOpenId(null); onEdit(); }}>Edit</button><button tabIndex={opened ? 0 : -1} className="danger" onClick={() => { setOpenId(null); onDelete(); }}>Delete</button></div>
    <div className="swipe-surface" style={{ transform: `translateX(${drag ?? (opened ? -144 : 0)}px)`, transition: drag === null ? undefined : "none" }}
      onPointerDown={e => { suppress.current = false; if (e.pointerType !== "touch") return; gesture.current = { x: e.clientX, y: e.clientY, base: opened ? -144 : 0, horizontal: false, vertical: false }; }}
      onPointerMove={e => { const g = gesture.current; if (!g || g.vertical) return; const dx = e.clientX - g.x, dy = e.clientY - g.y; if (!g.horizontal && Math.max(Math.abs(dx), Math.abs(dy)) > 8) { if (Math.abs(dy) >= Math.abs(dx)) { g.vertical = true; return; } g.horizontal = true; suppress.current = true; e.currentTarget.setPointerCapture(e.pointerId); setOpenId(null); } if (g.horizontal) setDrag(Math.max(-144, Math.min(0, g.base + dx))); }}
      onPointerUp={e => { const g = gesture.current; if (g?.horizontal) { setOpenId(g.base + e.clientX - g.x < -60 ? id : null); } gesture.current = null; setDrag(null); }}
      onPointerCancel={() => { gesture.current = null; setDrag(null); }}
      onClickCapture={e => { if (suppress.current || opened) { e.preventDefault(); e.stopPropagation(); const wasSwipe = suppress.current; suppress.current = false; if (opened && !wasSwipe) setOpenId(null); } }}>
      {children}
    </div>
  </div>;
}

export function PullRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const distance = useRef(0);
  const [pull, setPull] = useState(0); const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current; if (!node) return;
    const down = (e: TouchEvent) => { if (window.scrollY <= 0 && e.touches.length === 1 && !busy && !document.querySelector('[role="dialog"]') && !((e.target as Element).closest('input,button:not(.note-card),textarea,select'))) start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const move = (e: TouchEvent) => { const s = start.current; if (!s) return; const dx = e.touches[0].clientX - s.x, dy = e.touches[0].clientY - s.y; if (e.touches.length !== 1 || dy < 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) { start.current = null; distance.current = 0; setPull(0); return; } if (dy > 8) { e.preventDefault(); distance.current = Math.min(100, dy * .42); setPull(distance.current); } };
    const end = () => { start.current = null; const refresh = distance.current >= 64; distance.current = 0; setPull(0); if (refresh) { setBusy(true); void onRefresh().finally(() => setBusy(false)); } };
    const cancel = () => { start.current = null; distance.current = 0; setPull(0); };
    node.addEventListener("touchstart", down, { passive: true }); node.addEventListener("touchmove", move, { passive: false }); node.addEventListener("touchend", end); node.addEventListener("touchcancel", cancel);
    return () => { node.removeEventListener("touchstart", down); node.removeEventListener("touchmove", move); node.removeEventListener("touchend", end); node.removeEventListener("touchcancel", cancel); };
  }, [busy, onRefresh]);
  return <div ref={root}><div className="pull-indicator" style={{ height: busy ? 42 : pull }} role="status">{busy ? "✦ Refreshing…" : pull >= 64 ? "✦ Release to refresh" : pull > 8 ? "✦ Pull to refresh" : ""}</div>{children}</div>;
}

export function SheetHandle({ onClose }: { onClose: () => void }) {
  const start = useRef(0);
  return <button type="button" className="sheet-handle" aria-label="Close sheet" onClick={onClose} onPointerDown={e => { start.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { if (e.clientY - start.current > 55) onClose(); }}><span /></button>;
}
