/**
 * Import / export Excel de tout le catalogue de la boutique (admin).
 * Contrairement à l'import créateur, les changements s'appliquent DIRECTEMENT
 * (pas de demande de validation) et écrasent les données saisies par les créateurs.
 * Chaque créateur concerné reçoit une notification récapitulative.
 */
import ExcelJS from "exceljs";
import { prisma } from "./db";
import { PRODUCT_STATUS_LABEL } from "./constants";
import { euros } from "./money";
import { nextProductCode } from "./products";
import { notifyCreator } from "./notifications";
import { norm, SHEET_COLUMNS, type SheetError, type SheetRow } from "./product-sheet";

// ---------- Export ----------

export async function buildAdminProductsWorkbook(): Promise<Buffer> {
  const products = await prisma.product.findMany({
    include: { creator: { select: { name: true } } },
    orderBy: [{ creator: { name: "asc" } }, { name: "asc" }],
  });
  const wb = new ExcelJS.Workbook();
  wb.creator = "Les Songes Créatifs";
  const ws = wb.addWorksheet("Produits", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: SHEET_COLUMNS.brand, key: "brand", width: 24 },
    { header: SHEET_COLUMNS.code, key: "code", width: 26 },
    { header: SHEET_COLUMNS.reference, key: "reference", width: 18 },
    { header: SHEET_COLUMNS.name, key: "name", width: 36 },
    { header: SHEET_COLUMNS.price, key: "price", width: 11, style: { numFmt: "0.00" } },
    { header: SHEET_COLUMNS.quantity, key: "quantity", width: 11 },
    { header: SHEET_COLUMNS.status, key: "status", width: 13 },
    { header: SHEET_COLUMNS.sumupName, key: "sumupName", width: 44 },
  ];
  for (const p of products) {
    ws.addRow({
      brand: p.creator.name,
      code: p.code,
      reference: p.reference ?? "",
      name: p.name,
      price: p.priceCents / 100,
      quantity: p.stock,
      status: PRODUCT_STATUS_LABEL[p.status] ?? p.status,
      sumupName: p.sumupName ?? "",
    });
  }
  ws.getColumn("code").font = { color: { argb: "FF8A8D80" } };
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF626850" } };

  const help = wb.addWorksheet("Mode d'emploi");
  help.getColumn(1).width = 110;
  [
    "Catalogue complet de la boutique — mode d'emploi (administrateur)",
    "",
    "⚠ L'import admin écrase les données saisies par les créateurs, sans passer par leur validation.",
    "",
    "• Marque : nom exact de la marque du créateur (obligatoire).",
    "• Identifiant : ne le modifiez pas. Laissez-le vide pour créer un nouveau produit pour la marque indiquée.",
    "• Référence : obligatoire, unique par marque.",
    "• Nom et Prix (€) : obligatoires.",
    "• Quantité : stock en boutique. Vide = stock inchangé.",
    "• Statut : Actif, En attente, Refusé ou Archivé. Vide = inchangé (Actif pour un nouveau produit).",
    "• Nom dans la caisse SumUp : vide = nom par défaut « Identifiant - Nom - Marque ».",
    "• Les produits absents du fichier ne sont pas modifiés (l'import ne supprime rien).",
  ].forEach((t, i) => {
    const c = help.getCell(i + 1, 1);
    c.value = t;
    if (i === 0) c.font = { bold: true, size: 14 };
    if (i === 2) c.font = { bold: true, color: { argb: "FFB93A36" } };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- Import ----------

type AdminChanges = { reference?: string; name?: string; priceCents?: number; status?: string; sumupName?: string | null };

export type AdminImportPlan = {
  creates: (SheetRow & { creatorId: string; creatorName: string })[];
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
  const byCode = new Map(products.map((p) => [`${p.creatorId}|${p.code}`, p]));
  const byRef = new Map(products.filter((p) => p.reference).map((p) => [`${p.creatorId}|${p.reference}`, p]));

  const plan: AdminImportPlan = { creates: [], updates: [], unchanged: 0, errors };
  const touched = new Set<string>();

  for (const r of rows) {
    const creator = creatorByName.get(norm(r.brand ?? ""));
    if (!creator) {
      errors.push({ line: r.line, message: `Marque « ${r.brand} » inconnue : créez d'abord le créateur, ou corrigez l'orthographe.` });
      continue;
    }
    const product = r.code ? byCode.get(`${creator.id}|${r.code}`) : byRef.get(`${creator.id}|${r.reference}`);
    if (r.code && !product) {
      errors.push({ line: r.line, message: `Identifiant ${r.code} inconnu pour ${creator.name} : ne modifiez pas cette colonne.` });
      continue;
    }
    const owner = byRef.get(`${creator.id}|${r.reference}`);
    if (owner && owner.id !== product?.id) {
      errors.push({ line: r.line, message: `La référence ${r.reference} est déjà utilisée par « ${owner.name} » (${creator.name}).` });
      continue;
    }
    if (!product) {
      plan.creates.push({ ...r, creatorId: creator.id, creatorName: creator.name });
      continue;
    }
    if (touched.has(product.id)) {
      errors.push({ line: r.line, message: `« ${product.name} » (${creator.name}) apparaît plusieurs fois dans le fichier.` });
      continue;
    }
    touched.add(product.id);

    const changes: AdminChanges = {};
    if (r.reference !== product.reference) changes.reference = r.reference;
    if (r.name !== product.name) changes.name = r.name;
    if (r.priceCents !== product.priceCents) changes.priceCents = r.priceCents;
    if (r.status && r.status !== product.status) changes.status = r.status;
    if (r.sumupName !== undefined && r.sumupName !== product.sumupName) changes.sumupName = r.sumupName;
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
  if (c.status) out.push(`statut → ${PRODUCT_STATUS_LABEL[c.status] ?? c.status}`);
  if (c.sumupName !== undefined) out.push(c.sumupName ? `nom SumUp → « ${c.sumupName} »` : "nom SumUp → par défaut");
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

  await prisma.$transaction(async (tx) => {
    // Codes internes : suite de chaque créateur
    const nextCode = new Map<string, number>();
    for (const r of plan.creates) {
      if (!nextCode.has(r.creatorId)) nextCode.set(r.creatorId, parseInt(await nextProductCode(r.creatorId), 10));
      const n = nextCode.get(r.creatorId)!;
      nextCode.set(r.creatorId, n + 1);
      const code = String(n).padStart(3, "0");
      const p = await tx.product.create({
        data: {
          creatorId: r.creatorId,
          code,
          reference: r.reference,
          name: r.name,
          priceCents: r.priceCents,
          stock: r.quantity ?? 0,
          category: r.creatorName,
          status: r.status ?? "ACTIVE",
          sumupName: r.sumupName ?? null,
        },
      });
      if (p.stock > 0)
        await tx.stockMovement.create({ data: { productId: p.id, delta: p.stock, reason: "RESTOCK", note: "Stock initial (import Excel admin)", userId: adminId } });
      bump(r.creatorId, "created");
    }

    for (const u of plan.updates) {
      const data: Record<string, unknown> = { ...u.changes };
      if (u.stockTo !== null) {
        data.stock = u.stockTo;
        await tx.stockMovement.create({
          data: { productId: u.productId, delta: u.stockTo - u.stockFrom, reason: "CORRECTION", note: "Import Excel admin", userId: adminId },
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
