"use client";

import { useState } from "react";
import { ArrowDownUp, Pencil, Plus } from "lucide-react";
import { Modal } from "./modal";
import { ActionForm, SubmitButton, type FormAction } from "./action-form";
import { cn } from "@/lib/utils";

type P = { id: string; code: string; name: string; priceCents: number; category: string | null; stock: number };

export function StockDialog({ product, action }: { product: P; action: FormAction }) {
  const [direction, setDirection] = useState<"add" | "remove">("add");
  return (
    <Modal
      title={`Stock — ${product.code} - ${product.name}`}
      triggerClassName="btn btn-outline btn-sm"
      trigger={
        <>
          <ArrowDownUp size={16} /> Stock
        </>
      }
    >
      {(close) => (
        <ActionForm action={action} onSuccess={() => setTimeout(close, 700)} className="space-y-5">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="direction" value={direction} />
          <p className="text-muted">
            Stock actuel : <strong className="text-ink">{product.stock}</strong>
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-sage-50 p-1">
            {(["add", "remove"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={cn("rounded-lg py-2 text-sm font-semibold", direction === d ? "bg-sage-900 text-white" : "text-muted")}
              >
                {d === "add" ? "Ajouter du stock" : "Retirer du stock"}
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="qty">
              Quantité
            </label>
            <input id="qty" name="quantity" type="number" min={1} defaultValue={1} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="note">
              Note (optionnelle)
            </label>
            <input id="note" name="note" className="input" placeholder={direction === "add" ? "Dépôt du 12/11" : "Récupéré pour un marché"} />
          </div>
          <SubmitButton className="w-full">Valider</SubmitButton>
        </ActionForm>
      )}
    </Modal>
  );
}

function ProductFields({ product, withQuantity }: { product?: P; withQuantity?: boolean }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="name">
          Nom du produit
        </label>
        <input id="name" name="name" required defaultValue={product?.name} className="input" placeholder="Pot de fleurs (petit)" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="price">
            Prix (€)
          </label>
          <input
            id="price"
            name="price"
            required
            inputMode="decimal"
            defaultValue={product ? (product.priceCents / 100).toFixed(2) : ""}
            className="input"
            placeholder="20.00"
          />
        </div>
        {withQuantity && (
          <div>
            <label className="label" htmlFor="quantity">
              Quantité déposée
            </label>
            <input id="quantity" name="quantity" type="number" min={0} defaultValue={1} className="input" />
          </div>
        )}
      </div>
      <div>
        <label className="label" htmlFor="category">
          Catégorie
        </label>
        <input id="category" name="category" defaultValue={product?.category ?? ""} className="input" placeholder="Par défaut : votre nom de créateur" />
      </div>
    </>
  );
}

export function EditProductDialog({ product, action, pending }: { product: P; action: FormAction; pending?: boolean }) {
  return (
    <Modal
      title={`Modifier — ${product.code}`}
      triggerClassName="btn btn-outline btn-sm"
      trigger={
        <>
          <Pencil size={16} /> Modifier
        </>
      }
    >
      {(close) => (
        <ActionForm action={action} onSuccess={() => setTimeout(close, 1200)} className="space-y-5">
          <input type="hidden" name="productId" value={product.id} />
          {pending && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Une demande de modification est déjà en attente : elle sera remplacée par celle-ci.
            </p>
          )}
          <ProductFields product={product} />
          <p className="text-sm text-muted">Les modifications d&apos;un produit actif sont soumises à validation par Les Songes Créatifs.</p>
          <SubmitButton className="w-full">Envoyer</SubmitButton>
        </ActionForm>
      )}
    </Modal>
  );
}

export function CreateProductDialog({ action }: { action: FormAction }) {
  return (
    <Modal
      title="Ajouter un produit"
      triggerClassName="btn btn-primary px-6 py-3 text-base"
      trigger={
        <>
          <Plus size={18} /> Ajouter des produits
        </>
      }
    >
      <ActionForm action={action} resetOnSuccess className="space-y-5">
        <ProductFields withQuantity />
        <p className="text-sm text-muted">
          Le code produit est attribué automatiquement. Le produit sera « En attente » jusqu&apos;à sa validation et son ajout dans la caisse.
        </p>
        <SubmitButton className="w-full">Ajouter</SubmitButton>
      </ActionForm>
    </Modal>
  );
}
