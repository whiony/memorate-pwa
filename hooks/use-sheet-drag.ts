"use client";
import { useRef, useState, type PointerEvent } from "react";
export function useSheetDrag(onDismiss?: () => void) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ y: number; x: number; time: number; moved: boolean } | null>(null);
  const suppress = useRef(false);
  const reset = () => { gesture.current = null; setDragging(false); setOffset(0); };
  return {
    style: { transform: `translate3d(0,${offset}px,0)`, transition: dragging ? "none" : "transform 220ms ease-out" },
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      suppress.current=false;
      if (!onDismiss || e.pointerType !== "touch" || !matchMedia("(max-width:700px)").matches) return;
      const target=e.target as Element;
      if (!target.closest(".sheet-handle,.sheet-top") || target.closest(".sheet-top button")) return;
      gesture.current={y:e.clientY,x:e.clientX,time:e.timeStamp,moved:false};
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const g=gesture.current;if(!g)return;
      const dy=e.clientY-g.y;
      if(!g.moved && Math.abs(e.clientX-g.x)>Math.abs(dy)+8){reset();return;}
      if(Math.abs(dy)>5){g.moved=true;suppress.current=true;setDragging(true);setOffset(Math.max(0,dy*.85));}
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      const g=gesture.current;if(!g)return;
      const dy=Math.max(0,e.clientY-g.y),velocity=dy/Math.max(1,e.timeStamp-g.time);
      if(g.moved && (dy>120 || (dy>40 && velocity>.65)))onDismiss?.();
      reset();
    },
    onPointerCancel: reset,
    onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => { if(suppress.current){e.preventDefault();e.stopPropagation();suppress.current=false;} },
  };
}
