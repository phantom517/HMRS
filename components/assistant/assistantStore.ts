"use client";

// components/assistant/assistantStore.ts — the assistant's open state, shared
// by the Header button and the panel. Persisted across navigation (storage)
// and kept in sync across components via useSyncExternalStore. A module store
// instead of context so the button (layout) and the panel (Sidebar) don't
// have to be rendered under the same parent.
const STORAGE_KEY = "patanacademy-assistant-open";

let isOpen = false;
try {
  isOpen = typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1";
} catch {
  /* storage unavailable — start closed */
}

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): boolean {
  return isOpen;
}

export function setOpen(open: boolean) {
  if (open === isOpen) return;
  isOpen = open;
  try {
    if (open) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — the in-memory state still works */
  }
  emit();
}

export function toggle() {
  setOpen(!isOpen);
}
