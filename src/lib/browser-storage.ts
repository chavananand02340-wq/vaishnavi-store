import { LOCAL_CHANGE_EVENT } from "@/config/site";

/**
 * Safe wrappers around localStorage / sessionStorage.
 * Storage can be missing (server render), blocked (private mode) or full,
 * so every call is wrapped and falls back quietly. The shop still works without it.
 */
type Area = "local" | "session";

function area(kind: Area): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readText(key: string, kind: Area = "local"): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T, kind: Area = "local"): T {
  const raw = readText(key, kind);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Saves a value (string as-is, anything else as JSON). `null` removes the key. Tells this tab it changed. */
export function write(key: string, value: unknown, kind: Area = "local"): void {
  try {
    const a = area(kind);
    if (!a) return;
    if (value == null) a.removeItem(key);
    else a.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    /* blocked or full: keep going without it */
  }
  if (kind === "local" && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: key }));
}

export const remove = (key: string, kind: Area = "local") => write(key, null, kind);

/** Calls `fn` when `key` changes in this tab or another tab. Returns an unsubscribe function. */
export function onKeyChange(key: string, fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const changed = e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail;
    if (changed === key) fn();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(LOCAL_CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LOCAL_CHANGE_EVENT, handler);
  };
}
