"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "./modal";
import { ActionForm, SubmitButton } from "./action-form";
import { deleteCreatorAction, setCreatorActiveAction } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

export type CreatorDeletionInfo = {
  id: string;
  name: string;
  active: boolean;
  sales: number;
  payouts: number;
  products: number;
  documents: number;
};

/** Bouton « Supprimer » + fenêtre de confirmation (ou proposition de désactivation si historique). */
export function DeleteCreatorButton({ creator, compact }: { creator: CreatorDeletionInfo; compact?: boolean }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const hasHistory = creator.sales > 0 || creator.payouts > 0;

  return (
    <Modal
      title={`Supprimer ${creator.name} ?`}
      triggerClassName={cn("btn btn-danger", compact ? "btn-sm px-2" : "")}
      trigger={
        <>
          <Trash2 size={16} aria-hidden />
          {compact ? <span className="sr-only">Supprimer {creator.name}</span> : "Supprimer le créateur"}
        </>
      }
    >
      {(close) =>
        hasHistory ? (
          <div className="space-y-4">
            <p className="flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                Ce créateur ne peut pas être supprimé : <strong>{creator.sales} ligne(s) de vente</strong> et{" "}
                <strong>{creator.payouts} reversement(s)</strong> lui sont rattachés. Les supprimer effacerait l&apos;historique comptable de la
                boutique.
              </span>
            </p>
            {creator.active ? (
              <>
                <p className="text-muted">
                  Vous pouvez <strong className="text-ink">désactiver</strong> son compte : il ne pourra plus se connecter, mais ses ventes et
                  relevés restent consultables. Vous pourrez le réactiver depuis sa fiche.
                </p>
                <ActionForm
                  action={setCreatorActiveAction}
                  onSuccess={() => {
                    router.refresh();
                    setTimeout(close, 900);
                  }}
                >
                  <input type="hidden" name="id" value={creator.id} />
                  <input type="hidden" name="active" value="false" />
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-outline" onClick={close}>
                      Annuler
                    </button>
                    <SubmitButton className="btn-dark" pendingLabel="Désactivation…">
                      Désactiver le compte
                    </SubmitButton>
                  </div>
                </ActionForm>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <p className="text-muted">Son compte est déjà désactivé.</p>
                <button type="button" className="btn btn-outline" onClick={close}>
                  Fermer
                </button>
              </div>
            )}
          </div>
        ) : (
          <ActionForm
            action={deleteCreatorAction}
            onSuccess={() => {
              close();
              router.push("/admin/creators");
              router.refresh();
            }}
            className="space-y-4"
          >
            <input type="hidden" name="id" value={creator.id} />
            <p className="flex gap-3 rounded-xl bg-danger-50 p-4 text-danger-600">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden />
              <span>Cette action est définitive et ne peut pas être annulée.</span>
            </p>
            <div>
              <p className="mb-2">Seront supprimés :</p>
              <ul className="list-disc space-y-1 pl-6 text-muted">
                <li>son compte de connexion ;</li>
                <li>
                  {creator.products} produit(s) et leurs mouvements de stock ;
                </li>
                <li>
                  {creator.documents} document(s) déposé(s) ;
                </li>
                <li>ses notifications.</li>
              </ul>
            </div>
            <div>
              <label className="label" htmlFor={`confirm-${creator.id}`}>
                Pour confirmer, saisissez le nom de la marque : <span className="font-mono">{creator.name}</span>
              </label>
              <input
                id={`confirm-${creator.id}`}
                name="confirm"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={close}>
                Annuler
              </button>
              <ConfirmDeleteButton enabled={typed.trim() === creator.name} />
            </div>
          </ActionForm>
        )
      }
    </Modal>
  );
}

function ConfirmDeleteButton({ enabled }: { enabled: boolean }) {
  return (
    <SubmitButton className="btn-danger-solid" disabled={!enabled} pendingLabel="Suppression…">
      <Trash2 size={16} aria-hidden /> Supprimer définitivement
    </SubmitButton>
  );
}
