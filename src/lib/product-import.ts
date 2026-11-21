/**
 * Import / export Excel du catalogue d'un créateur.
 * Mêmes règles que la saisie manuelle :
 *  - nouveau produit → « En attente » de validation ;
 *  - quantité → mise à jour directe du stock (mouvement enregistré) ;
 *  - nom / prix / référence d'un produit validé → demande de modification à l'admin ;
 *  - produits absents du fichier : inchangés (l'import ne supprime rien).
 */
import ExcelJS from "exceljs";
import { prisma } from "./db";
import { PRODUCT_STATUS_LABEL } from "./constants";
import { euros } from "./money";
import { nextProductCode } from "./products";
import { notifyAdmins } from "./notifications";
import { cellValue, readProductRows, SHEET_COLUMNS, type SheetError, type SheetRow } from "./product-sheet";

const SHEET_NAME = "Produits";

// ---------- Export ----------

export async function buildProductsWorkbook(creatorId: string, brand: string): Promise<Buffer> {
  const products = await prisma.product.findMany({
    where: { creatorId, status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Les Songes Créatifs";
  const ws = wb.addWorksheet(SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: SHEET_COLUMNS.code, key: "code", width: 26 },
    { header: SHEET_COLUMNS.reference, key: "reference", width: 20 },
    { header: SHEET_COLUMNS.name, key: "name", width: 40 },
    { header: SHEET_COLUMNS.price, key: "price", width: 12, style: { numFmt: "0.00" } },
    { header: SHEET_COLUMNS.quantity, key: "quantity", width: 12 },
    { header: SHEET_COLUMNS.status, key: "status", width: 14 },
  ];
  for (const p of products) {
    ws.addRow({
      code: p.code,
      reference: p.reference ?? "",
      name: p.name,
      price: p.priceCents / 100,
      quantity: p.stock,
      status: PRODUCT_STATUS_LABEL[p.status] ?? p.status,
    });
  }
  // Colonnes informatives en gris, puis en-tête (appliqué en dernier pour rester blanc sur vert)
  ws.getColumn("code").font = { color: { argb: "FF8A8D80" } };
  ws.getColumn("status").font = { color: { argb: "FF8A8D80" } };
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF626850" } };

  const help = wb.addWorksheet("Mode d'emploi");
  help.getColumn(1).width = 110;
  [
    `Catalogue ${brand} — mode d'emploi`,
    "",
    "• Modifiez l'onglet « Produits » puis importez le fichier depuis « Mes produits » › Importer (Excel).",
    "• Identifiant : ne le modifiez pas. Laissez-le vide pour une nouvelle ligne.",
    "• Référence : obligatoire, unique parmi vos produits (lettres sans accent, chiffres, tirets, points ou barres).",
    "• Nom et Prix (€) : obligatoires. Prix avec virgule ou point (ex. 12,50).",
    "• Quantité : votre stock déposé en boutique (nombre entier). Laissez vide pour ne pas changer le stock.",
    "• Statut : pour information, ignoré à l'import.",
    "",
    "À l'import :",
    "• les nouvelles lignes créent des produits « En attente » de validation ;",
    "• les quantités mettent à jour votre stock immédiatement ;",
    "• un changement de nom, prix ou référence d'un produit validé est envoyé pour validation ;",
    "• les produits absents du fichier ne sont pas modifiés (l'import ne supprime rien).",
  ].forEach((t, i) => {
    const c = help.getCell(i + 1, 1);
    c.value = t;
    if (i === 0) c.font = { bold: true, size: 14 };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- Import ----------

export async function readWorkbook(buf: Buffer): Promise<{ rows: SheetRow[]; errors: SheetError[] }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    return { rows: [], errors: [{ line: 0, message: "Fichier illisible : enregistrez-le au format Excel (.xlsx)." }] };
  }
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) return { rows: [], errors: [{ line: 0, message: "Le fichier ne contient aucune feuille." }] };
  const matrix: (string | number | null)[][] = [];
  const width = Math.max(ws.columnCount, 6);
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    matrix[n - 1] = Array.from({ length: width }, (_, i) => cellValue(row.getCell(i + 1).value));
  });
  for (let i = 0; i < matrix.length; i++) matrix[i] ??= [];
  return readProductRows(matrix);
}

type Changes = { reference?: string; name?: string; priceCents?: number };

export type ImportPlan = {
  creates: SheetRow[];
  updates: {
    line: number;
    productId: string;
    name: string;
    status: string;
    stockFrom: number;
    stockTo: number | null;
    changes: Changes;
  }[];
  unchanged: number;
  errors: SheetError[];
};

export async function planImport(creatorId: string, rows: SheetRow[], parseErrors: SheetError[]): Promise<ImportPlan> {
  const errors = [...parseErrors];
  const products = await prisma.product.findMany({ where: { creatorId, status: { not: "ARCHIVED" } } });
  const byCode = new Map(products.map((p) => [p.code, p]));
  const byRef = new Map(products.filter((p) => p.reference).map((p) => [p.reference!, p]));

  const plan: ImportPlan = { creates: [], updates: [], unchanged: 0, errors };
  const touched = new Set<string>();

  for (const r of rows) {
    const product = r.code ? byCode.get(r.code) : byRef.get(r.reference);
    if (r.code && !product) {
      errors.push({ line: r.line, message: `Identifiant ${r.code} inconnu : ne modifiez pas cette colonne (laissez-la vide pour un nouveau produit).` });
      continue;
    }
    const owner = byRef.get(r.reference);
    if (owner && owner.id !== product?.id) {
      errors.push({ line: r.line, message: `La référence ${r.reference} est déjà utilisée par « ${owner.name} ».` });
      continue;
    }
    if (!product) {
      plan.creates.push(r);
      continue;
    }
    if (touched.has(product.id)) {
      errors.push({ line: r.line, message: `« ${product.name} » apparaît plusieurs fois dans le fichier.` });
      continue;
    }
    touched.add(product.id);

    const changes: Changes = {};
    if (r.reference !== product.reference) changes.reference = r.reference;
    if (r.name !== product.name) changes.name = r.name;
    if (r.priceCents !== product.priceCents) changes.priceCents = r.priceCents;
    const stockTo = r.quantity !== null && r.quantity !== product.stock ? r.quantity : null;
    if (stockTo !== null && product.status === "REJECTED") {
      errors.push({ line: r.line, message: `« ${product.name} » a été refusé : son stock ne peut pas être modifié.` });
      continue;
    }
    if (stockTo === null && Object.keys(changes).length === 0) {
      plan.unchanged++;
      continue;
    }
    plan.updates.push({ line: r.line, productId: product.id, name: product.name, status: product.status, stockFrom: product.stock, stockTo, changes });
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
  return out;
}

export async function applyImport(creator: { id: string; name: string }, userId: string, plan: ImportPlan) {
  if (plan.errors.length) throw new Error("Le fichier contient des erreurs : rien n'a été importé.");
  let requests = 0;
  await prisma.$transaction(async (tx) => {
    const base = await nextProductCode(creator.id);
    for (const [i, r] of plan.creates.entries()) {
      const code = String(parseInt(base, 10) + i).padStart(3, "0");
      const p = await tx.product.create({
        data: {
          creatorId: creator.id,
          code,
          reference: r.reference,
          name: r.name,
          priceCents: r.priceCents,
          stock: r.quantity ?? 0,
          category: creator.name,
          status: "PENDING",
        },
      });
      if (p.stock > 0)
        await tx.stockMovement.create({ data: { productId: p.id, delta: p.stock, reason: "RESTOCK", note: "Stock initial (import Excel)", userId } });
    }

    for (const u of plan.updates) {
      if (u.stockTo !== null) {
        const delta = u.stockTo - u.stockFrom;
        await tx.product.update({ where: { id: u.productId }, data: { stock: u.stockTo } });
        await tx.stockMovement.create({
          data: { productId: u.productId, delta, reason: delta > 0 ? "RESTOCK" : "REMOVAL", note: "Import Excel", userId },
        });
      }
      if (Object.keys(u.changes).length === 0) continue;
      if (u.status === "PENDING") {
        await tx.product.update({ where: { id: u.productId }, data: u.changes });
      } else {
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
      title: "Import Excel d'un créateur",
      body: `${creator.name} : ${plan.creates.length} nouveau(x) produit(s) et ${requests} demande(s) de modification à valider.`,
      link: "/admin/products",
    });
  }
  return { created: plan.creates.length, updated: plan.updates.length, requests };
}
