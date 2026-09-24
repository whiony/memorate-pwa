"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useAppUpdate(unsafe: boolean) {
  const [available, setAvailable] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const unsafeRef = useRef(unsafe);
  useEffect(() => { unsafeRef.current = unsafe; }, [unsafe]);
  const check = useCallback(async () => { try { await registration.current?.update(); if (registration.current?.waiting) setAvailable(true); } catch { /* Offline: keep the installed version. */ } }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let disposed = false;
    let controlled = !!navigator.serviceWorker.controller;
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(async r => {
      if (disposed) return; registration.current = r;
      const ready = () => { if (r.waiting && navigator.serviceWorker.controller) setAvailable(true); };
      ready(); r.addEventListener("updatefound", () => r.installing?.addEventListener("statechange", ready));
      await check();
      const active = await navigator.serviceWorker.ready;
      active.active?.postMessage({ type: "PRECACHE", assets: performance.getEntriesByType("resource").map(e => e.name).slice(0, 128) });
    }).catch(() => {});
    const foreground = () => { if (document.visibilityState === "visible") void check(); };
    const changed = () => { if (!controlled) { controlled = true; return; } if (unsafeRef.current) setAvailable(true); else location.reload(); };
    document.addEventListener("visibilitychange", foreground); window.addEventListener("online", check); navigator.serviceWorker.addEventListener("controllerchange", changed);
    return () => { disposed = true; document.removeEventListener("visibilitychange", foreground); window.removeEventListener("online", check); navigator.serviceWorker.removeEventListener("controllerchange", changed); };
  }, [check]);
  const apply = () => { if (unsafeRef.current) return; if (registration.current?.waiting) registration.current.waiting.postMessage({ type: "ACTIVATE" }); else location.reload(); };
  return { available, check, apply };
}
