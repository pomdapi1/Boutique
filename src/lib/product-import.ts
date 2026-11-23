/**
 * Import / export du catalogue d'un créateur au format CSV d'articles SumUp.
 * Mêmes règles que la saisie manuelle :
 *  - nouveau produit → « En attente » de validation ;
 *  - Quantity → mise à jour directe du stock (mouvement enregistré) ;
 *  - nom / prix / SKU d'un produit validé → demande de modification à l'admin ;
 *  - Item id / Variant id SumUp → enregistrés directement (identifiants techniques) ;
 *  - produits absents du fichier : inchangés (l'import ne supprime rien).
 */
import { prisma } from "./db";
import { euros } from "./money";
import { canonicalSumupName, normalize } from "./attribution";
import { decodeText, parseCsv, toCsv } from "./csv";
import { nextProductCode } from "./products";
import { notifyAdmins } from "./notifications";
import { getDefaultVatRate } from "./settings";
import {
  norm,
  productNameFromItemName,
  readProductRows,
  sumupCsvRow,
  SUMUP_HEADERS,
  type SheetError,
  type SheetRow,
} from "./product-sheet";

// ---------- Export ----------

type ExportProduct = {
  name: string;
  reference: string | null;
  priceCents: number;
  stock: number;
  status: string;
  sumupName: string | null;
  sumupItemId: string | null;
  sumupVariantId: string | null;
};

/** CSV au format SumUp (importable tel quel dans la caisse). */
export async function productsToSumUpCsv(items: { product: ExportProduct; brand: string }[]): Promise<string> {
  const vatRate = await getDefaultVatRate();
  return toCsv([
    [...SUMUP_HEADERS],
    ...items.map(({ product: p, brand }) =>
      sumupCsvRow({
        itemName: p.sumupName ?? canonicalSumupName({ name: p.name, creatorName: brand }),
        brand,
        reference: p.reference,
        priceCents: p.priceCents,
        stock: p.stock,
        visible: p.status === "ACTIVE",
        vatRate,
        itemId: p.sumupItemId,
        variantId: p.sumupVariantId,
      }),
    ),
  ]);
}

export async function buildCreatorProductsCsv(creatorId: string, brand: string): Promise<string> {
  const products = await prisma.product.findMany({ where: { creatorId, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } });
  return productsToSumUpCsv(products.map((product) => ({ product, brand })));
}

// ---------- Import ----------

/** Fichier envoyé par le formulaire d'import : présent, ≤ 2,5 Mo, CSV texte. */
export async function uploadedCsv(fd: FormData): Promise<{ text: string } | { error: string }> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier CSV (format SumUp)." };
  if (file.size > 2.5 * 1024 * 1024) return { error: "Fichier trop volumineux (2,5 Mo maximum)." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf[0] === 0x50 && buf[1] === 0x4b)
    return { error: "Ce fichier est un classeur Excel (.xlsx) : enregistrez-le au format CSV (Fichier › Enregistrer sous › CSV)." };
  return { text: decodeText(buf) };
}

export function readCsv(text: string, opts: { admin?: boolean } = {}) {
  return readProductRows(parseCsv(text), opts);
}

/** Nom d'article SumUp effectif d'un produit (personnalisé ou « Marque - Nom »). */
export function effectiveItemName(p: { name: string; sumupName: string | null }, brand: string) {
  return p.sumupName ?? canonicalSumupName({ name: p.name, creatorName: brand });
}

type Changes = { reference?: string; name?: string; priceCents?: number };
type TechChanges = { sumupItemId?: string; sumupVariantId?: string };

export type ImportPlan = {
  creates: (SheetRow & { name: string })[];
  updates: {
    line: number;
    productId: string;
    name: string;
    status: string;
    stockFrom: number;
    stockTo: number | null;
    changes: Changes;
    tech: TechChanges;
  }[];
  unchanged: number;
  errors: SheetError[];
};

export async function planImport(creator: { id: string; name: string }, rows: SheetRow[], parseErrors: SheetError[]): Promise<ImportPlan> {
  const errors = [...parseErrors];
  const products = await prisma.product.findMany({ where: { creatorId: creator.id, status: { not: "ARCHIVED" } } });
  const byItemId = new Map(products.filter((p) => p.sumupItemId).map((p) => [p.sumupItemId!, p]));
  const byRef = new Map(products.filter((p) => p.reference).map((p) => [p.reference!, p]));
  const byItemName = new Map(products.map((p) => [normalize(effectiveItemName(p, creator.name)), p]));

  const plan: ImportPlan = { creates: [], updates: [], unchanged: 0, errors };
  const touched = new Set<string>();

  for (const r of rows) {
    if (r.brand && norm(r.brand) !== norm(creator.name)) {
      errors.push({ line: r.line, message: `Cette ligne appartient à la marque « ${r.brand} » (colonne Category) : seuls vos produits peuvent être importés.` });
      continue;
    }
    const name = productNameFromItemName(r.itemName, creator.name);
    if (name.length < 2 || name.length > 120) {
      errors.push({ line: r.line, message: "Nom du produit manquant ou trop long (120 caractères maximum) après la marque." });
      continue;
    }
    const product = (r.itemId ? byItemId.get(r.itemId) : undefined) ?? byRef.get(r.reference) ?? byItemName.get(normalize(r.itemName));
    const owner = byRef.get(r.reference);
    if (owner && owner.id !== product?.id) {
      errors.push({ line: r.line, message: `La référence (SKU) ${r.reference} est déjà utilisée par « ${owner.name} ».` });
      continue;
    }
    if (!product) {
      plan.creates.push({ ...r, name });
      continue;
    }
    if (touched.has(product.id)) {
      errors.push({ line: r.line, message: `« ${product.name} » apparaît plusieurs fois dans le fichier.` });
      continue;
    }
    touched.add(product.id);

    const changes: Changes = {};
    if (r.reference !== product.reference) changes.reference = r.reference;
    if (name !== product.name) changes.name = name;
    if (r.priceCents !== product.priceCents) changes.priceCents = r.priceCents;
    const tech: TechChanges = {};
    if (r.itemId && r.itemId !== product.sumupItemId) tech.sumupItemId = r.itemId;
    if (r.variantId && r.variantId !== product.sumupVariantId) tech.sumupVariantId = r.variantId;
    const stockTo = r.quantity !== null && r.quantity !== product.stock ? r.quantity : null;
    if (stockTo !== null && product.status === "REJECTED") {
      errors.push({ line: r.line, message: `« ${product.name} » a été refusé : son stock ne peut pas être modifié.` });
      continue;
    }
    if (stockTo === null && !Object.keys(changes).length && !Object.keys(tech).length) {
      plan.unchanged++;
      continue;
    }
    plan.updates.push({ line: r.line, productId: product.id, name: product.name, status: product.status, stockFrom: product.stock, stockTo, changes, tech });
  }
  plan.errors.sort((a, b) => a.line - b.line);
  return plan;
}

/** Résumé lisible d'une mise à jour (aperçu). */
export function describeUpdate(u: ImportPlan["updates"][number]): string[] {
  const out: string[] = [];
  if (u.stockTo !== null) out.push(`stock ${u.stockFrom} → ${u.stockTo}`);
  const c = u.changes;
  if (c.reference) out.push(`référence → ${c.reference}`);
  if (c.name) out.push(`nom → « ${c.name} »`);
  if (c.priceCents !== undefined) out.push(`prix → ${euros(c.priceCents)}`);
  if (Object.keys(c).length && u.status !== "PENDING") out[out.length - 1] += " (soumis à validation)";
  if (Object.keys(u.tech).length) out.push("identifiants SumUp enregistrés");
  return out;
}

export async function applyImport(creator: { id: string; name: string }, userId: string, plan: ImportPlan) {
  if (plan.errors.length) throw new Error("Le fichier contient des erreurs : rien n'a été importé.");
  let requests = 0;
  const base = parseInt(await nextProductCode(creator.id), 10);
  await prisma.$transaction(async (tx) => {
    for (const [i, r] of plan.creates.entries()) {
      const p = await tx.product.create({
        data: {
          creatorId: creator.id,
          code: String(base + i).padStart(3, "0"),
          reference: r.reference,
          name: r.name,
          priceCents: r.priceCents,
          stock: r.quantity ?? 0,
          category: creator.name,
          status: "PENDING",
          sumupItemId: r.itemId,
          sumupVariantId: r.variantId,
        },
      });
      if (p.stock > 0)
        await tx.stockMovement.create({ data: { productId: p.id, delta: p.stock, reason: "RESTOCK", note: "Stock initial (import CSV)", userId } });
    }

    for (const u of plan.updates) {
      const direct: Record<string, unknown> = { ...u.tech };
      if (u.stockTo !== null) {
        const delta = u.stockTo - u.stockFrom;
        direct.stock = u.stockTo;
        await tx.stockMovement.create({ data: { productId: u.productId, delta, reason: delta > 0 ? "RESTOCK" : "REMOVAL", note: "Import CSV", userId } });
      }
      const hasChanges = Object.keys(u.changes).length > 0;
      if (hasChanges && u.status === "PENDING") Object.assign(direct, u.changes);
      if (Object.keys(direct).length) await tx.product.update({ where: { id: u.productId }, data: direct });
      if (hasChanges && u.status !== "PENDING") {
        await tx.productRequest.updateMany({
          where: { productId: u.productId, status: "PENDING" },
          data: { status: "REJECTED", adminNote: "Remplacée par une demande plus récente", decidedAt: new Date() },
        });
        await tx.productRequest.create({ data: { productId: u.productId, creatorId: creator.id, changes: JSON.stringify(u.changes) } });
        requests++;
      }
    }
  });

  if (plan.creates.length || requests) {
    await notifyAdmins({
      kind: "PRODUCT",
      title: "Import CSV d'un créateur",
      body: `${creator.name} : ${plan.creates.length} nouveau(x) produit(s) et ${requests} demande(s) de modification à valider.`,
      link: "/admin/products",
    });
  }
  const message =
    `Import terminé : ${plan.creates.length} produit(s) créé(s) (en attente de validation), ${plan.updates.length} produit(s) mis à jour` +
    (requests ? `, dont ${requests} modification(s) envoyée(s) pour validation.` : ".");
  return { message };
}
