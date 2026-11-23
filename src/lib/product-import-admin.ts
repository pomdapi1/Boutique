/**
 * Import / export CSV SumUp de tout le catalogue de la boutique (admin).
 * Contrairement à l'import créateur, les changements s'appliquent DIRECTEMENT
 * (pas de demande de validation) et écrasent les données saisies par les créateurs.
 * Chaque créateur concerné reçoit une notification récapitulative.
 *
 * Marque d'une ligne : colonne Category, sinon début de l'Item name (« Marque - Nom »).
 */
import { prisma } from "./db";
import { euros } from "./money";
import { normalize } from "./attribution";
import { nextProductCode } from "./products";
import { notifyCreator } from "./notifications";
import { getDefaultVatRate } from "./settings";
import { vatLabel } from "./constants";
import { effectiveItemName, productsToSumUpCsv } from "./product-import";
import { norm, productNameFromItemName, type SheetError, type SheetRow } from "./product-sheet";

// ---------- Export ----------

export async function buildAdminProductsCsv(): Promise<string> {
  const products = await prisma.product.findMany({
    include: { creator: { select: { name: true } } },
    orderBy: [{ creator: { name: "asc" } }, { name: "asc" }],
  });
  return productsToSumUpCsv(products.map((product) => ({ product, brand: product.creator.name })));
}

// ---------- Import ----------

type AdminChanges = {
  reference?: string;
  name?: string;
  priceCents?: number;
  vatRate?: number | null;
  sumupName?: string;
  sumupItemId?: string;
  sumupVariantId?: string;
};

export type AdminImportPlan = {
  creates: (SheetRow & { name: string; creatorId: string; creatorName: string })[];
  updates: {
    line: number;
    productId: string;
    creatorId: string;
    creatorName: string;
    name: string;
    stockFrom: number;
    stockTo: number | null;
    changes: AdminChanges;
  }[];
  unchanged: number;
  errors: SheetError[];
};

export async function planAdminImport(rows: SheetRow[], parseErrors: SheetError[]): Promise<AdminImportPlan> {
  const errors = [...parseErrors];
  const [creators, products] = await Promise.all([
    prisma.creator.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany(),
  ]);
  const creatorByName = new Map(creators.map((c) => [norm(c.name), c]));
  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const byItemId = new Map(products.filter((p) => p.sumupItemId).map((p) => [p.sumupItemId!, p]));
  const byRef = new Map(products.filter((p) => p.reference).map((p) => [`${p.creatorId}|${p.reference}`, p]));
  const byItemName = new Map(products.map((p) => [`${p.creatorId}|${normalize(effectiveItemName(p, creatorById.get(p.creatorId)?.name ?? ""))}`, p]));

  /** Marque : colonne Category, sinon début de l'Item name (« Marque - Nom », la marque pouvant contenir « - »). */
  function findCreator(r: SheetRow) {
    if (r.brand) return creatorByName.get(norm(r.brand));
    const seps = [...r.itemName.matchAll(/\s+[-–—]\s+/g)];
    for (const m of seps) {
      const c = creatorByName.get(norm(r.itemName.slice(0, m.index)));
      if (c) return c;
    }
    return undefined;
  }

  const plan: AdminImportPlan = { creates: [], updates: [], unchanged: 0, errors };
  const touched = new Set<string>();

  for (const r of rows) {
    const creator = findCreator(r);
    if (!creator) {
      errors.push({
        line: r.line,
        message: r.brand
          ? `Marque « ${r.brand} » (colonne Category) inconnue : créez d'abord le créateur, ou corrigez l'orthographe.`
          : "Marque introuvable : renseignez la colonne Category ou nommez l'article « Marque - Nom ».",
      });
      continue;
    }
    const name = productNameFromItemName(r.itemName, creator.name);
    if (name.length < 2 || name.length > 120) {
      errors.push({ line: r.line, message: "Nom du produit manquant ou trop long (120 caractères maximum) après la marque." });
      continue;
    }
    const byId = r.itemId ? byItemId.get(r.itemId) : undefined;
    if (byId && byId.creatorId !== creator.id) {
      errors.push({ line: r.line, message: `L'Item id appartient à un produit de « ${creatorById.get(byId.creatorId)?.name} » : ne modifiez pas cette colonne.` });
      continue;
    }
    const product = byId ?? byRef.get(`${creator.id}|${r.reference}`) ?? byItemName.get(`${creator.id}|${normalize(r.itemName)}`);
    const owner = byRef.get(`${creator.id}|${r.reference}`);
    if (owner && owner.id !== product?.id) {
      errors.push({ line: r.line, message: `La référence (SKU) ${r.reference} est déjà utilisée par « ${owner.name} » (${creator.name}).` });
      continue;
    }
    if (!product) {
      plan.creates.push({ ...r, name, creatorId: creator.id, creatorName: creator.name });
      continue;
    }
    if (touched.has(product.id)) {
      errors.push({ line: r.line, message: `« ${product.name} » (${creator.name}) apparaît plusieurs fois dans le fichier.` });
      continue;
    }
    touched.add(product.id);

    const changes: AdminChanges = {};
    if (r.reference !== product.reference) changes.reference = r.reference;
    if (name !== product.name) changes.name = name;
    if (r.priceCents !== product.priceCents) changes.priceCents = r.priceCents;
    if (r.vatRate !== undefined && r.vatRate !== product.vatRate) changes.vatRate = r.vatRate;
    // Nom d'article de la caisse : enregistré s'il diffère du nom effectif après changement de nom
    const effective = effectiveItemName({ name: changes.name ?? product.name, sumupName: product.sumupName }, creator.name);
    if (normalize(r.itemName) !== normalize(effective)) changes.sumupName = r.itemName;
    if (r.itemId && r.itemId !== product.sumupItemId) changes.sumupItemId = r.itemId;
    if (r.variantId && r.variantId !== product.sumupVariantId) changes.sumupVariantId = r.variantId;
    const stockTo = r.quantity !== null && r.quantity !== product.stock ? r.quantity : null;
    if (stockTo === null && Object.keys(changes).length === 0) {
      plan.unchanged++;
      continue;
    }
    plan.updates.push({
      line: r.line,
      productId: product.id,
      creatorId: creator.id,
      creatorName: creator.name,
      name: product.name,
      stockFrom: product.stock,
      stockTo,
      changes,
    });
  }
  plan.errors.sort((a, b) => a.line - b.line);
  return plan;
}

export function describeAdminUpdate(u: AdminImportPlan["updates"][number]): string[] {
  const out: string[] = [];
  if (u.stockTo !== null) out.push(`stock ${u.stockFrom} → ${u.stockTo}`);
  const c = u.changes;
  if (c.reference) out.push(`référence → ${c.reference}`);
  if (c.name) out.push(`nom → « ${c.name} »`);
  if (c.priceCents !== undefined) out.push(`prix → ${euros(c.priceCents)}`);
  if (c.vatRate !== undefined) out.push(vatLabel(c.vatRate).replace("TVA ", "TVA → "));
  if (c.sumupName) out.push(`nom dans la caisse → « ${c.sumupName} »`);
  if (c.sumupItemId || c.sumupVariantId) out.push("identifiants SumUp enregistrés");
  return out;
}

export async function applyAdminImport(adminId: string, plan: AdminImportPlan) {
  if (plan.errors.length) throw new Error("Le fichier contient des erreurs : rien n'a été importé.");
  const perCreator = new Map<string, { created: number; updated: number }>();
  const bump = (id: string, k: "created" | "updated") => {
    const v = perCreator.get(id) ?? { created: 0, updated: 0 };
    v[k]++;
    perCreator.set(id, v);
  };
  const defaultVat = await getDefaultVatRate();
  // Codes internes : suite de chaque créateur
  const nextCode = new Map<string, number>();
  for (const r of plan.creates)
    if (!nextCode.has(r.creatorId)) nextCode.set(r.creatorId, parseInt(await nextProductCode(r.creatorId), 10));

  await prisma.$transaction(async (tx) => {
    for (const r of plan.creates) {
      const n = nextCode.get(r.creatorId)!;
      nextCode.set(r.creatorId, n + 1);
      const isDefaultName = normalize(r.itemName) === normalize(effectiveItemName({ name: r.name, sumupName: null }, r.creatorName));
      const p = await tx.product.create({
        data: {
          creatorId: r.creatorId,
          code: String(n).padStart(3, "0"),
          reference: r.reference,
          name: r.name,
          priceCents: r.priceCents,
          vatRate: r.vatRate !== undefined ? r.vatRate : defaultVat,
          stock: r.quantity ?? 0,
          category: r.creatorName,
          status: "ACTIVE",
          sumupName: isDefaultName ? null : r.itemName,
          sumupItemId: r.itemId,
          sumupVariantId: r.variantId,
        },
      });
      if (p.stock > 0)
        await tx.stockMovement.create({ data: { productId: p.id, delta: p.stock, reason: "RESTOCK", note: "Stock initial (import CSV admin)", userId: adminId } });
      bump(r.creatorId, "created");
    }

    for (const u of plan.updates) {
      const data: Record<string, unknown> = { ...u.changes };
      if (u.stockTo !== null) {
        data.stock = u.stockTo;
        await tx.stockMovement.create({
          data: { productId: u.productId, delta: u.stockTo - u.stockFrom, reason: "CORRECTION", note: "Import CSV admin", userId: adminId },
        });
      }
      await tx.product.update({ where: { id: u.productId }, data });
      bump(u.creatorId, "updated");
    }
  });

  for (const [creatorId, n] of perCreator) {
    await notifyCreator(creatorId, {
      kind: "PRODUCT",
      title: "Votre catalogue a été mis à jour par Les Songes Créatifs",
      body: [n.created ? `${n.created} produit(s) ajouté(s)` : "", n.updated ? `${n.updated} produit(s) modifié(s)` : ""].filter(Boolean).join(", ") + ".",
      link: "/creator/products",
    });
  }
  return {
    message: `Import terminé : ${plan.creates.length} produit(s) créé(s), ${plan.updates.length} produit(s) modifié(s), ${perCreator.size} créateur(s) notifié(s).`,
  };
}
