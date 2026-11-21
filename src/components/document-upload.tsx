"use client";

import { useActionState, useEffect, useRef } from "react";
import { RefreshCw, Upload } from "lucide-react";
import type { FormAction } from "./action-form";
import { cn } from "@/lib/utils";

/** Bouton d'envoi de fichier : la sélection déclenche directement l'upload. */
export function DocumentUpload({
  action,
  type,
  accept,
  replaceId,
  creatorId,
  addLabel = "Déposer un fichier",
  variant = "button",
}: {
  action: FormAction;
  type: string;
  accept: string;
  replaceId?: string;
  creatorId?: string;
  /** Libellé du bouton d'ajout (hors remplacement). */
  addLabel?: string;
  /** "dashed" : grande zone pointillée pleine largeur. */
  variant?: "button" | "dashed";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = replaceId ? "Remplacer" : addLabel;
  const dashed = variant === "dashed" && !replaceId;

  useEffect(() => {
    if (state) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={cn("flex flex-col", dashed ? "w-full" : "inline-flex items-end")}>
      <input type="hidden" name="type" value={type} />
      {replaceId && <input type="hidden" name="replaceId" value={replaceId} />}
      {creatorId && <input type="hidden" name="creatorId" value={creatorId} />}
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept={accept}
        aria-label={label}
        className="hidden"
        onChange={(e) => e.currentTarget.files?.length && formRef.current?.requestSubmit()}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className={
          dashed
            ? "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-5 text-muted transition hover:border-sage-400 hover:bg-sage-50 hover:text-ink disabled:opacity-60"
            : replaceId
              ? "btn btn-ghost"
              : "btn btn-outline"
        }
      >
        {replaceId ? <RefreshCw size={18} aria-hidden /> : <Upload size={18} aria-hidden />}
        {pending ? "Envoi…" : label}
      </button>
      {state?.error && <span className="mt-1 text-sm text-danger-600">{state.error}</span>}
    </form>
  );
}
