"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "./Icon";

type Tone = "ok" | "error" | "info";
type T = { id: number; text: string; tone: Tone };
const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const toast = useCallback((text: string, tone: Tone = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 6000 : 2800);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`animate-pop pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-[15px] font-semibold shadow-lg ${
              t.tone === "error" ? "bg-rose-700 text-white" : t.tone === "info" ? "bg-ink text-white" : "bg-leaf-700 text-white"
            }`}
          >
            <Icon name={t.tone === "error" ? "alert" : "check"} className="mt-0.5 size-5 shrink-0" />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
