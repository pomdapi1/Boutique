"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Modal } from "./modal";
import type { ImportState } from "@/lib/import-state";

type ImportAction = (prev: ImportState, fd: FormData) => Promise<ImportState>;

type Options = {
  action: ImportAction;
  exportHref: string;
  /** Texte de la 2e étape (ce qu'on peut modifier dans le fichier). */
  editHint: string;
  /** Avertissement affiché en tête + case à cocher obligatoire avant confirmation (import admin). */
  warning?: string;
};

function ImportForm({ action, exportHref, editHint, warning, close }: Options & { close: () => void }) {
  const [state, dispatch, pending] = useActionState(action, null);
  // Le fichier est gardé en mémoire : React réinitialise les champs d'un <form action> après envoi,
  // ce qui viderait le fichier entre l'aperçu et la confirmation.
  const [file, setFile] = useState<File | null>(null);
  const [ack, setAck] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (mode: "preview" | "apply", f: File | null = file) => {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    fd.append("mode", mode);
    if (ack) fd.append("ack", "1");
    startTransition(() => dispatch(fd));
  };

  if (state?.mode === "applied" && state.result) {
    return (
      <div className="space-y-4">
        <p className="flex gap-3 rounded-xl bg-success-bg p-4 text-success">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden />
          <span>{state.result.message}</span>
        </p>
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={close}>
            Voir le catalogue
          </button>
        </div>
      </div>
    );
  }

  const hasPreview = state?.mode === "preview";
  const blocked = !!state?.errors?.length;
  const nothing = hasPreview && !state.creates?.length && !state.updates?.length;

  return (
    <div className="space-y-5">
      {warning && (
        <div role="note" className="flex gap-3 rounded-xl border border-danger-100 bg-danger-50 p-4 text-danger-600">
          <AlertTriangle size={22} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Attention : cet import écrase les données des créateurs.</p>
            <p className="mt-1 text-sm">{warning}</p>
          </div>
        </div>
      )}

      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>
          Téléchargez le catalogue avec{" "}
          <a href={exportHref} className="font-medium text-ink underline">
            Exporter (Excel)
          </a>{" "}
          : il sert de modèle{warning ? " et de sauvegarde" : ""}.
        </li>
        <li>{editHint}</li>
        <li>Importez le fichier : un aperçu s&apos;affiche avant tout enregistrement.</li>
      </ol>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="Fichier Excel à importer"
        className="hidden"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0] ?? null;
          setFile(f);
          e.currentTarget.value = ""; // permet de resélectionner le même fichier après correction
          if (f) submit("preview", f);
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-5 text-muted transition hover:border-sage-400 hover:bg-sage-50 hover:text-ink disabled:opacity-60"
      >
        <FileSpreadsheet size={20} aria-hidden />
        {pending ? "Analyse du fichier…" : (file?.name ?? "Choisir un fichier Excel (.xlsx)")}
      </button>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {state.error}
        </p>
      )}

      {hasPreview && (
        <div className="space-y-4" aria-live="polite">
          {blocked && (
            <div className="rounded-xl bg-danger-50 p-4 text-danger-600">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={18} aria-hidden /> {state.errors!.length} erreur(s) : corrigez le fichier puis réimportez-le. Rien n&apos;a été
                enregistré.
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                {state.errors!.map((e, i) => (
                  <li key={i}>
                    {e.line > 0 && <strong>Ligne {e.line} : </strong>}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!state.creates?.length && (
            <div>
              <p className="font-semibold">
                {state.creates.length} nouveau(x) produit(s){warning ? "" : " — en attente de validation"}
              </p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-sm text-muted">
                {state.creates.map((c) => (
                  <li key={c.line}>
                    {c.brand ? `${c.brand} · ` : ""}
                    {c.reference} · {c.name} · {c.price} · stock {c.quantity}
                    {c.status ? ` · ${c.status}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!state.updates?.length && (
            <div>
              <p className="font-semibold">{state.updates.length} produit(s) modifié(s)</p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-sm text-muted">
                {state.updates.map((u) => (
                  <li key={u.line}>
                    {u.name} : {u.details.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!state.unchanged && <p className="text-sm text-muted">{state.unchanged} produit(s) sans changement.</p>}
          {nothing && !blocked && <p className="text-sm text-muted">Aucune modification détectée dans ce fichier.</p>}
        </div>
      )}

      {warning && hasPreview && !blocked && !nothing && (
        <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-danger-600" />
          <span>
            J&apos;ai compris que ces modifications remplacent les données saisies par les créateurs, sans validation de leur part.
          </span>
        </label>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-outline" onClick={close}>
          Annuler
        </button>
        {hasPreview && !blocked && !nothing && (
          <button
            type="button"
            className={warning ? "btn btn-danger-solid" : "btn btn-primary"}
            disabled={pending || (!!warning && !ack)}
            onClick={() => submit("apply")}
          >
            <Upload size={16} aria-hidden /> {pending ? "Import en cours…" : "Confirmer l'import"}
          </button>
        )}
      </div>
    </div>
  );
}

export function ProductExcelActions(props: Options & { title?: string }) {
  return (
    <>
      <a href={props.exportHref} className="btn btn-outline px-4 py-3" title="Télécharger le catalogue au format Excel">
        <Download size={18} aria-hidden /> Exporter (Excel)
      </a>
      <Modal
        title={props.title ?? "Importer des produits (Excel)"}
        wide
        triggerClassName="btn btn-outline px-4 py-3"
        trigger={
          <>
            <Upload size={18} aria-hidden /> Importer (Excel)
          </>
        }
      >
        {(close) => <ImportForm {...props} close={close} />}
      </Modal>
    </>
  );
}
