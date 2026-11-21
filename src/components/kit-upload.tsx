"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Upload } from "lucide-react";

type Kit = { filename: string; sizeLabel: string; uploadedLabel: string } | null;

/** Dépôt du kit com par l'admin (route /api/kit : jusqu'à 50 Mo). */
export function KitUpload({ kit }: { kit: Kit }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(file: File) {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/kit", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setMsg({ ok: false, text: data.error ?? "Envoi impossible." });
      else {
        setMsg({ ok: true, text: "Kit com mis à jour : il est disponible pour tous les créateurs." });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Envoi impossible (connexion interrompue ?)." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!window.confirm("Retirer le kit com ? Les créateurs ne pourront plus le télécharger.")) return;
    setBusy(true);
    const res = await fetch("/api/kit", { method: "DELETE" });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Kit com retiré." } : { ok: false, text: "Suppression impossible." });
    router.refresh();
  }

  return (
    <div>
      {kit ? (
        <p className="mb-4 text-sm">
          Fichier actuel : <strong>{kit.filename}</strong>{" "}
          <span className="text-muted">
            ({kit.sizeLabel}, déposé le {kit.uploadedLabel})
          </span>
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted italic">Aucun kit déposé : les créateurs voient « pas encore disponible ».</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.pdf,image/png,image/jpeg"
        aria-label="Fichier du kit com"
        className="hidden"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) void send(f);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={18} aria-hidden /> {busy ? "Envoi…" : kit ? "Remplacer le kit" : "Déposer le kit"}
        </button>
        {kit && (
          <>
            <a href="/api/kit" className="btn btn-outline" download>
              <Download size={18} aria-hidden /> Télécharger
            </a>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>
              <Trash2 size={18} aria-hidden /> Retirer
            </button>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">ZIP, PDF, PNG ou JPEG — 50 Mo maximum. Astuce : regroupez logos, icônes et posts dans un fichier ZIP.</p>
      {msg && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success-bg text-success" : "bg-danger-50 text-danger-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
