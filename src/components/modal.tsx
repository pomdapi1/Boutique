"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const CloseCtx = createContext<() => void>(() => {});
export const useCloseModal = () => useContext(CloseCtx);

/**
 * Modale contrôlée par son bouton déclencheur.
 * `children` peut être une fonction recevant `close` (ex. pour fermer après succès).
 */
export function Modal({
  trigger,
  triggerClassName,
  title,
  children,
  wide,
  defaultOpen = false,
}: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  title: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  wide?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn("relative w-full rounded-2xl bg-cream p-6 shadow-xl sm:p-8", wide ? "max-w-5xl" : "max-w-lg")}
          >
            <button type="button" onClick={close} className="absolute top-5 right-5 text-muted hover:text-ink" aria-label="Fermer">
              <X size={20} />
            </button>
            <h2 className="mb-5 pr-8 text-2xl font-semibold">{title}</h2>
            <CloseCtx.Provider value={close}>{typeof children === "function" ? children(close) : children}</CloseCtx.Provider>
          </div>
        </div>
      )}
    </>
  );
}
