"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { euros, parseEurosToCents } from "@/lib/money";
import { notifyAdmins } from "@/lib/notifications";
import { DocumentError, deleteDocument, saveDocument } from "@/lib/documents";
import { productLabel } from "@/lib/utils";
import { normalizeReference } from "@/lib/reference";
import { charCount, normalizeText } from "@/lib/text";
import { applyImport, describeUpdate, planImport, readCsv, uploadedCsv } from "@/lib/product-import";
import type { ImportState } from "@/lib/import-state";
import { BRAND_PITCH_MAX, SALES_NOTES_MAX } from "@/lib/constants";
import { isReferenceTaken, nextProductCode } from "@/lib/products";
import type { ActionState } from "@/components/action-form";

const qtySchema = z.coerce.number().int().min(1, "Quantité minimale : 1").max(10000);


export async function adjustStockAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, creator } = await requireCreator();
  const product = await prisma.product.findFirst({
    where: { id: String(fd.get("productId")), creatorId: creator.id },
  });
  if (!product) return { error: "Produit introuvable." };
  if (product.status === "REJECTED" || product.status === "ARCHIVED")
    return { error: "Ce produit n'est plus actif." };

  const qty = qtySchema.safeParse(fd.get("quantity"));
  if (!qty.success) return { error: qty.error.issues[0]!.message };
  const direction = fd.get("direction") === "remove" ? -1 : 1;
  const delta = direction * qty.data;
  if (product.stock + delta < 0) return { error: `Impossible de retirer plus que le stock actuel (${product.stock}).` };

  await prisma.$transaction([
    prisma.product.update({ where: { id: product.id }, data: { stock: { increment: delta } } }),
    prisma.stockMovement.create({
      data: {
        productId: product.id,
        delta,
        reason: delta > 0 ? "RESTOCK" : "REMOVAL",
        note: String(fd.get("note") ?? "").slice(0, 200) || null,
        userId: user.id,
      },
    }),
  ]);
  revalidatePath("/creator/products");
  return { ok: true, message: `Stock mis à jour : ${product.stock + delta}.` };
}

const productSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120),
  price: z.string(),
  category: z.string().trim().max(60).optional(),
});

export async function createProductAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { creator } = await requireCreator();
  const parsed = productSchema.safeParse({
    name: fd.get("name"),
    price: fd.get("price"),
    category: fd.get("category") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const ref = normalizeReference(fd.get("reference"));
  if ("error" in ref) return { error: ref.error };
  const priceCents = parseEurosToCents(parsed.data.price);
  if (priceCents === null || priceCents <= 0) return { error: "Prix invalide." };
  const qty = z.coerce.number().int().min(0).max(10000).safeParse(fd.get("quantity") || 0);
  if (!qty.success) return { error: "Quantité invalide." };
  const taken = await isReferenceTaken(creator.id, ref.value);
  if (taken) return { error: taken };

  const code = await nextProductCode(creator.id);
  const product = await prisma.product.create({
    data: {
      creatorId: creator.id,
      code,
      reference: ref.value,
      name: parsed.data.name,
      priceCents,
      category: parsed.data.category || creator.name,
      stock: qty.data,
      status: "PENDING",
    },
  });
  if (qty.data > 0) {
    await prisma.stockMovement.create({ data: { productId: product.id, delta: qty.data, reason: "RESTOCK", note: "Stock initial" } });
  }
  await notifyAdmins({
    kind: "PRODUCT",
    title: "Nouveau produit à valider",
    body: `${productLabel(product)} — ${creator.name}`,
    link: "/admin/products",
  });
  revalidatePath("/creator/products");
  return { ok: true, message: `Produit « ${parsed.data.name} » (réf. ${ref.value}) créé — en attente de validation.` };
}

export async function requestProductChangeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { creator } = await requireCreator();
  const product = await prisma.product.findFirst({
    where: { id: String(fd.get("productId")), creatorId: creator.id },
  });
  if (!product) return { error: "Produit introuvable." };

  const parsed = productSchema.safeParse({
    name: fd.get("name"),
    price: fd.get("price"),
    category: fd.get("category") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const ref = normalizeReference(fd.get("reference"));
  if ("error" in ref) return { error: ref.error };
  const priceCents = parseEurosToCents(parsed.data.price);
  if (priceCents === null || priceCents <= 0) return { error: "Prix invalide." };

  const changes: Record<string, string | number> = {};
  if (ref.value !== product.reference) {
    const taken = await isReferenceTaken(creator.id, ref.value, product.id);
    if (taken) return { error: taken };
    changes.reference = ref.value;
  }
  if (parsed.data.name !== product.name) changes.name = parsed.data.name;
  if (priceCents !== product.priceCents) changes.priceCents = priceCents;
  if ((parsed.data.category || null) !== product.category && parsed.data.category) changes.category = parsed.data.category;
  if (Object.keys(changes).length === 0) return { error: "Aucune modification." };

  // Produit pas encore validé : modification directe.
  if (product.status === "PENDING") {
    await prisma.product.update({ where: { id: product.id }, data: changes });
    revalidatePath("/creator/products");
    return { ok: true, message: "Produit modifié." };
  }

  await prisma.$transaction([
    prisma.productRequest.updateMany({
      where: { productId: product.id, status: "PENDING" },
      data: { status: "REJECTED", adminNote: "Remplacée par une demande plus récente", decidedAt: new Date() },
    }),
    prisma.productRequest.create({
      data: { productId: product.id, creatorId: creator.id, changes: JSON.stringify(changes) },
    }),
  ]);
  await notifyAdmins({
    kind: "REQUEST",
    title: "Demande de modification",
    body: `${productLabel(product)} — ${creator.name}`,
    link: "/admin/products",
  });
  revalidatePath("/creator/products");
  return { ok: true, message: "Demande envoyée : elle sera appliquée après validation par Les Songes Créatifs." };
}

/**
 * Suppression d'un produit par son créateur.
 * - Jamais vendu : suppression définitive (mouvements de stock et demandes en cascade).
 * - Déjà vendu : archivé (masqué du catalogue) pour conserver l'historique des ventes
 *   et des statistiques ; sa référence est libérée pour pouvoir être réutilisée.
 */
export async function deleteProductAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { creator } = await requireCreator();
  const product = await prisma.product.findFirst({
    where: { id: String(fd.get("productId")), creatorId: creator.id, status: { not: "ARCHIVED" } },
  });
  if (!product) return { error: "Produit introuvable." };

  const sold = await prisma.saleItem.count({ where: { productId: product.id } });
  if (sold === 0) {
    await prisma.product.delete({ where: { id: product.id } });
  } else {
    await prisma.$transaction([
      prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED", reference: null } }),
      prisma.productRequest.updateMany({
        where: { productId: product.id, status: "PENDING" },
        data: { status: "REJECTED", adminNote: "Produit supprimé par le créateur", decidedAt: new Date() },
      }),
    ]);
  }

  // Un produit déjà validé est présent dans la caisse : l'admin doit l'en retirer.
  if (product.status === "ACTIVE") {
    await notifyAdmins({
      kind: "PRODUCT",
      title: "Produit supprimé par un créateur",
      body: `${productLabel(product)} — ${creator.name}${product.stock > 0 ? ` (stock restant : ${product.stock})` : ""}\nPensez à retirer l'article de la caisse SumUp.`,
      link: "/admin/products?tab=all",
    });
  }
  revalidatePath("/creator/products");
  return { ok: true, message: `« ${product.name} » a été supprimé de votre catalogue.` };
}

export async function uploadDocumentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { creator } = await requireCreator();
  try {
    await saveDocument({
      creatorId: creator.id,
      type: String(fd.get("type")),
      file: fd.get("file") as File,
      replaceId: (fd.get("replaceId") as string) || null,
    });
  } catch (e) {
    if (e instanceof DocumentError) return { error: e.message };
    throw e;
  }
  revalidatePath("/creator/documents");
  return { ok: true, message: "Document enregistré." };
}

export async function deleteDocumentAction(fd: FormData) {
  const { creator } = await requireCreator();
  await deleteDocument(String(fd.get("id")), creator.id);
  revalidatePath("/creator/documents");
}

/** Import CSV SumUp : mode "preview" (aperçu, rien n'est enregistré) puis "apply" (application). */
export async function importProductsAction(_p: ImportState, fd: FormData): Promise<ImportState> {
  const { user, creator } = await requireCreator();
  const upload = await uploadedCsv(fd);
  if ("error" in upload) return { error: upload.error };

  const { rows, errors } = readCsv(upload.text);
  const plan = await planImport(creator, rows, errors);
  const preview: ImportState = {
    mode: "preview",
    creates: plan.creates.map((r) => ({ line: r.line, reference: r.reference, name: r.name, price: euros(r.priceCents), quantity: r.quantity ?? 0 })),
    updates: plan.updates.map((u) => ({ line: u.line, name: u.name, details: describeUpdate(u) })),
    unchanged: plan.unchanged,
    errors: plan.errors,
  };
  if (fd.get("mode") !== "apply" || plan.errors.length) return preview;
  if (plan.creates.length === 0 && plan.updates.length === 0) return { ...preview, error: "Aucune modification à importer." };

  const { message } = await applyImport(creator, user.id, plan);
  revalidatePath("/creator/products");
  return { mode: "applied", result: { message } };
}

export async function saveCommunicationTextsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { creator } = await requireCreator();
  const pitch = normalizeText(fd.get("brandPitch"));
  const notes = normalizeText(fd.get("salesNotes"));
  if (charCount(pitch) > BRAND_PITCH_MAX) return { error: `Présentation trop longue (${BRAND_PITCH_MAX} caractères maximum).` };
  if (charCount(notes) > SALES_NOTES_MAX) return { error: `Recommandations trop longues (${SALES_NOTES_MAX} caractères maximum).` };
  await prisma.creator.update({
    where: { id: creator.id },
    data: { brandPitch: pitch || null, salesNotes: notes || null },
  });
  revalidatePath("/creator/documents");
  return { ok: true, message: "Textes enregistrés." };
}
