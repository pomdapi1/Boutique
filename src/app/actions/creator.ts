"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseEurosToCents } from "@/lib/money";
import { notifyAdmins } from "@/lib/notifications";
import { DocumentError, deleteDocument, saveDocument } from "@/lib/documents";
import { productLabel } from "@/lib/utils";
import type { ActionState } from "@/components/action-form";

const qtySchema = z.coerce.number().int().min(1, "Quantité minimale : 1").max(10000);

async function nextProductCode(creatorId: string) {
  const codes = await prisma.product.findMany({ where: { creatorId }, select: { code: true } });
  const max = codes.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0);
  return String(max + 1).padStart(3, "0");
}

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
  const priceCents = parseEurosToCents(parsed.data.price);
  if (priceCents === null || priceCents <= 0) return { error: "Prix invalide." };
  const qty = z.coerce.number().int().min(0).max(10000).safeParse(fd.get("quantity") || 0);
  if (!qty.success) return { error: "Quantité invalide." };

  const code = await nextProductCode(creator.id);
  const product = await prisma.product.create({
    data: {
      creatorId: creator.id,
      code,
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
  return { ok: true, message: `Produit ${code} créé — en attente de validation.` };
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
  const priceCents = parseEurosToCents(parsed.data.price);
  if (priceCents === null || priceCents <= 0) return { error: "Prix invalide." };

  const changes: Record<string, string | number> = {};
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
  return { ok: true, message: "Demande envoyée : elle sera appliquée après validation par Conserve." };
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
