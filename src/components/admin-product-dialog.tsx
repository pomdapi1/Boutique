"use client";

import { Pencil } from "lucide-react";
import { Modal } from "./modal";
import { ActionForm, SubmitButton, type FormAction } from "./action-form";
import { PRODUCT_STATUS_LABEL } from "@/lib/constants";
import { VatSelect } from "./product-dialogs";

type P = {
  id: string;
  code: string;
  reference: string | null;
  name: string;
  priceCents: number;
  vatRate: number | null;
  category: string | null;
  stock: number;
  status: string;
  sumupName: string | null;
  canonical: string;
};

export function AdminProductDialog({ product, action }: { product: P; action: FormAction }) {
  return (
    <Modal
      title={`Produit ${product.code}`}
      triggerClassName="btn btn-outline btn-sm"
      triggerTitle="Modifier"
      trigger={
        <>
          <Pencil size={16} aria-hidden />
          {/* Libellé visible sur grand écran ; sinon icône seule (nom accessible conservé) */}
          <span className="sr-only 2xl:not-sr-only">Modifier</span>
        </>
      }
    >
      <ActionForm action={action} className="space-y-4">
        <input type="hidden" name="id" value={product.id} />
        <div className="grid grid-cols-[2fr_3fr] gap-4">
          <div>
            <label className="label" htmlFor={`ref-${product.id}`}>
              Référence
            </label>
            <input
              id={`ref-${product.id}`}
              name="reference"
              maxLength={40}
              defaultValue={product.reference ?? ""}
              placeholder="à renseigner"
              className="input uppercase placeholder:normal-case"
            />
          </div>
          <div>
            <label className="label" htmlFor={`name-${product.id}`}>
              Nom
            </label>
            <input id={`name-${product.id}`} name="name" defaultValue={product.name} required className="input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Prix (€)</label>
            <input name="price" defaultValue={(product.priceCents / 100).toFixed(2)} required className="input" />
          </div>
          <div>
            <label className="label">Stock (correction)</label>
            <input name="stock" type="number" min={0} defaultValue={product.stock} required className="input" />
          </div>
        </div>
        <VatSelect value={product.vatRate} id={`vat-${product.id}`} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Catégorie</label>
            <input name="category" defaultValue={product.category ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Statut</label>
            <select name="status" defaultValue={product.status} className="input">
              {Object.entries(PRODUCT_STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Nom dans la caisse SumUp</label>
          <input name="sumupName" defaultValue={product.sumupName ?? ""} placeholder={product.canonical} className="input" />
          <p className="mt-1 text-xs text-muted">Laisser vide si l&apos;article est nommé « {product.canonical} » dans SumUp.</p>
        </div>
        <SubmitButton className="w-full">Enregistrer</SubmitButton>
      </ActionForm>
    </Modal>
  );
}
