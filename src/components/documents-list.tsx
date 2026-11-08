import { FileText, Trash2 } from "lucide-react";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { dateLabel } from "@/lib/dates";
import { formatSize } from "@/lib/documents";
import { DocumentUpload } from "./document-upload";
import type { FormAction } from "./action-form";

type Doc = { id: string; type: string; filename: string; sizeBytes: number; createdAt: Date };

/** Liste des documents par type (utilisée côté créateur et côté admin). */
export function DocumentsList({
  docs,
  uploadAction,
  deleteAction,
  creatorId,
}: {
  docs: Doc[];
  uploadAction?: FormAction;
  deleteAction?: (fd: FormData) => Promise<void>;
  creatorId?: string;
}) {
  return (
    <div className="space-y-6">
      {DOCUMENT_TYPES.map((t) => {
        const list = docs.filter((d) => d.type === t.type);
        const accept = t.mimeTypes.join(",");
        return (
          <section key={t.type} className="card p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{t.label}</h2>
              <span className="text-sm text-muted">{t.hint}</span>
            </div>
            <ul className="space-y-3">
              {list.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-cream/60 px-5 py-4">
                  <FileText size={22} className="text-muted" />
                  <a href={`/api/documents/${d.id}`} className="min-w-0 flex-1 hover:underline">
                    <div className="truncate font-medium">{d.filename}</div>
                    <div className="text-sm text-muted">
                      {dateLabel(d.createdAt)} · {formatSize(d.sizeBytes)}
                    </div>
                  </a>
                  {uploadAction && <DocumentUpload action={uploadAction} type={t.type} accept={accept} replaceId={d.id} creatorId={creatorId} />}
                  {deleteAction && (
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={d.id} />
                      {creatorId && <input type="hidden" name="creatorId" value={creatorId} />}
                      <button className="btn btn-ghost px-2" aria-label={`Supprimer ${d.filename}`}>
                        <Trash2 size={18} />
                      </button>
                    </form>
                  )}
                </li>
              ))}
              {list.length === 0 && <li className="text-sm text-muted">Aucun document déposé.</li>}
            </ul>
            {uploadAction && list.length < t.max && (
              <div className="mt-4">
                <DocumentUpload action={uploadAction} type={t.type} accept={accept} creatorId={creatorId} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
