"use client";

import { useActionState, useEffect, useRef } from "react";
import { RefreshCw, Upload } from "lucide-react";
import type { FormAction } from "./action-form";

/** Bouton d'envoi de fichier : la sélection déclenche directement l'upload. */
export function DocumentUpload({
  action,
  type,
  accept,
  replaceId,
  creatorId,
}: {
  action: FormAction;
  type: string;
  accept: string;
  replaceId?: string;
  creatorId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="inline-flex flex-col items-end">
      <input type="hidden" name="type" value={type} />
      {replaceId && <input type="hidden" name="replaceId" value={replaceId} />}
      {creatorId && <input type="hidden" name="creatorId" value={creatorId} />}
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.currentTarget.files?.length && formRef.current?.requestSubmit()}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className={replaceId ? "btn btn-ghost" : "btn btn-outline"}
      >
        {replaceId ? <RefreshCw size={18} /> : <Upload size={18} />}
        {pending ? "Envoi…" : replaceId ? "Remplacer" : "Déposer un fichier"}
      </button>
      {state?.error && <span className="mt-1 text-sm text-danger-600">{state.error}</span>}
    </form>
  );
}
