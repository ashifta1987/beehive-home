"use client";

import { createContext, useCallback, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/ui";

type ToastItem = { id: number; text: string; tone: "ok" | "bad" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "bad") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: "ok" | "bad" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex flex-col items-center gap-2 px-4 min-[960px]:bottom-6">
        {items.map((t) => (
          <div key={t.id} role="status" className={cn("pointer-events-auto rounded-[14px] px-4 py-3 text-[14px] font-semibold shadow-card", t.tone === "ok" ? "bg-ink text-surface" : "bg-bad text-on-bad")}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/**
 * Run a server action with pending state, error text and router refresh.
 *   const { run, pending, error } = useAction();
 *   await run(() => saveThing(data), { success: "Saved", onDone: close });
 */
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts?: { success?: string; onDone?: (data?: T) => void; refresh?: boolean }) =>
      new Promise<ActionResult<T>>((resolve) => {
        setError(null);
        start(async () => {
          let res: ActionResult<T>;
          try {
            res = await fn();
          } catch {
            res = { ok: false, error: "We could not reach the server. Check your connection and try again." };
          }
          if (res.ok) {
            if (opts?.success) toast(opts.success);
            if (opts?.refresh !== false) router.refresh();
            opts?.onDone?.(res.data);
          } else {
            setError(res.error);
          }
          resolve(res);
        });
      }),
    [router, toast],
  );

  return { run, pending, error, setError };
}

