import { Download, ImageIcon, Trash2 } from "lucide-react";
import { BRAND_PITCH_MAX, PHOTO_TYPE, SALES_NOTES_MAX } from "@/lib/constants";
import { dateLabel } from "@/lib/dates";
import { formatSize } from "@/lib/documents";
import type { KitInfo } from "@/lib/kit";
import { BRAND_NAME } from "./brand-logo";
import { DocumentUpload } from "./document-upload";
import { CommunicationTexts } from "./communication-texts";
import type { FormAction } from "./action-form";

type Photo = { id: string; filename: string; sizeBytes: number; createdAt: Date };

/** Section « Communication » de l'espace créateur (photos, textes, kit com). */
export function CommunicationSection({
  photos,
  brandPitch,
  salesNotes,
  kit,
  uploadAction,
  deleteAction,
  textsAction,
}: {
  photos: Photo[];
  brandPitch: string | null;
  salesNotes: string | null;
  kit: KitInfo | null;
  uploadAction: FormAction;
  deleteAction: (fd: FormData) => Promise<void>;
  textsAction: FormAction;
}) {
  const accept = PHOTO_TYPE.mimeTypes.join(",");
  return (
    <section className="card p-6 sm:p-8" aria-labelledby="communication-title">
      <h2 id="communication-title" className="mb-6 text-lg font-semibold">
        Communication
      </h2>

      <h3 className="font-semibold">Photos</h3>
      <p className="mb-4 text-sm text-muted">{PHOTO_TYPE.hint}</p>
      <ul className="space-y-3">
        {photos.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-cream/60 px-5 py-4">
            <ImageIcon size={22} className="text-muted" aria-hidden />
            <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 hover:underline">
              <div className="truncate font-medium">{d.filename}</div>
              <div className="text-sm text-muted">
                {dateLabel(d.createdAt)} · {formatSize(d.sizeBytes)}
              </div>
            </a>
            <DocumentUpload action={uploadAction} type={PHOTO_TYPE.type} accept={accept} replaceId={d.id} />
            <form action={deleteAction}>
              <input type="hidden" name="id" value={d.id} />
              <button className="btn btn-ghost px-2" aria-label={`Supprimer ${d.filename}`} title="Supprimer">
                <Trash2 size={18} aria-hidden />
              </button>
            </form>
          </li>
        ))}
      </ul>
      {photos.length < PHOTO_TYPE.max ? (
        <div className="mt-3">
          <DocumentUpload action={uploadAction} type={PHOTO_TYPE.type} accept={accept} addLabel="Ajouter une photo" variant="dashed" />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          {PHOTO_TYPE.max} photos maximum : remplacez ou supprimez-en une pour en ajouter une autre.
        </p>
      )}

      <div className="mt-8">
        <CommunicationTexts
          action={textsAction}
          brandPitch={brandPitch ?? ""}
          salesNotes={salesNotes ?? ""}
          pitchMax={BRAND_PITCH_MAX}
          notesMax={SALES_NOTES_MAX}
        />
      </div>

      <hr className="my-8 border-line" />

      <h3 className="font-semibold">Kit com {BRAND_NAME}</h3>
      <p className="mb-4 text-sm text-muted">Logos, icônes et posts de {BRAND_NAME} à utiliser pour votre communication.</p>
      {kit ? (
        <a href="/api/kit" className="btn btn-outline" download>
          <Download size={18} aria-hidden /> Télécharger le kit com
          <span className="font-normal text-muted">({formatSize(kit.sizeBytes)})</span>
        </a>
      ) : (
        <p className="text-sm text-muted italic">Le kit com n&apos;est pas encore disponible.</p>
      )}
    </section>
  );
}
