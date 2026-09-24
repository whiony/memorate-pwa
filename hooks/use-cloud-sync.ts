"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authProvider, syncService, type Session } from "@/lib/sync";
import { repository } from "@/lib/repository";
export type SyncStatus = { phase: "local" | "pending" | "syncing" | "synced" | "offline" | "error"; session: Session; syncedAt?: string; error?: string };

// All triggers share one flight and status. Signing in is sufficient to sync;
// the stored baseline describes reconciliation, not a per-device opt-in switch.
export function useCloudSync(ready: boolean, onData: () => Promise<void>, onConflict: () => void) {
  const [status, setStatus] = useState<SyncStatus>({ phase: "local", session: { user: null } });
  const callbacks = useRef({ onData, onConflict });
  useEffect(() => { callbacks.current = { onData, onConflict }; }, [onData, onConflict]);
  const flight = useRef<Promise<void> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const failures = useRef(0);
  const active = useRef(false);
  const run = useCallback(function synchronize(reason = "manual"): Promise<void> {
    if (!active.current) return Promise.resolve();
    if (flight.current) return flight.current;
    clearTimeout(retry.current);
    if (!navigator.onLine) { setStatus(s => ({ ...s, phase: "offline" })); return Promise.resolve(); }
    const operation = async () => {
      try {
        const session = await authProvider.session();
        if (!active.current) return;
        if (!session.user) { setStatus({ phase: "local", session }); return; }
        setStatus(s => ({ ...s, phase: "syncing", session, error: undefined }));
        const result = await syncService.sync();
        const metadata = await repository.syncMetadata();
        if (!active.current) return;
        if (result.changed) await callbacks.current.onData();
        failures.current = 0;
        setStatus({ phase: result.pending ? "pending" : "synced", session, syncedAt: metadata?.syncedAt });
        if (result.conflicts) callbacks.current.onConflict();
        if (result.pending) retry.current = setTimeout(() => { void synchronize("pending"); }, 750);
        // Diagnostic metadata only: never log titles, photos, identity or tokens.
        if (process.env.NODE_ENV === "development") console.debug("[Memorate sync]", { reason, conflicts: result.conflicts, pending: result.pending });
      } catch (error) {
        if (!active.current) return;
        const offline = !navigator.onLine;
        setStatus(s => ({ ...s, phase: offline ? "offline" : "error", error: error instanceof Error ? error.message : "Cloud sync failed. Local notes are safe." }));
        if (!offline) {
          const delay = Math.min(30000, 2000 * 2 ** Math.min(failures.current++, 4));
          retry.current = setTimeout(() => { void synchronize("retry"); }, delay);
        }
        if (process.env.NODE_ENV === "development") console.debug("[Memorate sync]", { reason, outcome: offline ? "offline" : "failed", attempt: failures.current });
      }
    };
    flight.current = operation().finally(() => { flight.current = null; });
    return flight.current;
  }, []);
  useEffect(() => {
    if (!ready) return;
    active.current = true;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      if (flight.current) return; // perform() retains and reports in-flight edits.
      setStatus(s => ({ ...s, phase: navigator.onLine ? (s.session.user ? "pending" : "local") : "offline" }));
      clearTimeout(debounce); debounce = setTimeout(() => { void run("local-change"); }, 750);
    };
    const foreground = () => { if (document.visibilityState === "visible") void run("foreground"); };
    const online = () => { void run("online"); };
    const offline = () => { setStatus(s => ({ ...s, phase: "offline" })); };
    window.addEventListener("memorate-change", changed); window.addEventListener("online", online); window.addEventListener("offline", offline); window.addEventListener("focus", foreground); window.addEventListener("pageshow", foreground); document.addEventListener("visibilitychange", foreground);
    // Pull remote edits even while this device remains on an unchanged feed.
    const poll = setInterval(foreground, 15000);
    void run("open");
    return () => { active.current = false; clearTimeout(debounce); clearTimeout(retry.current); clearInterval(poll); window.removeEventListener("memorate-change", changed); window.removeEventListener("online", online); window.removeEventListener("offline", offline); window.removeEventListener("focus", foreground); window.removeEventListener("pageshow", foreground); document.removeEventListener("visibilitychange", foreground); };
  }, [ready, run]);
  return { status, synchronize: run };
}
