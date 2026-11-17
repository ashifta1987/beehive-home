"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/ui";

/**
 * Bottom sheet on phones, centred dialog on desktop (≥ 960 px).
 * Put the form inside `children`; pass Cancel + primary buttons in `footer` (sticky).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-sheet-close])");
      (el ?? panelRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center min-[960px]:items-center" role="presentation">
      <div className="absolute inset-0 bg-scrim" style={{ animation: "bh-fade .15s ease-out" }} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col bg-surface shadow-card outline-none",
          "rounded-t-[28px] min-[960px]:rounded-[28px]",
          wide ? "min-[960px]:max-w-[760px]" : "min-[960px]:max-w-[560px]",
        )}
        style={{ animation: "bh-sheet-up .2s ease-out" }}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line min-[960px]:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
          <h2 id={titleId} className="font-display text-[18px] font-extrabold tracking-[-0.02em]">
            {title}
          </h2>
          <button
            type="button"
            data-sheet-close
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? (
          <div className="pb-safe sticky bottom-0 flex gap-2 border-t border-line bg-surface px-5 pt-3 [&>*]:flex-1">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

