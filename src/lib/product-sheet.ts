/**
 * Lecture d'un tableau de produits (lignes déjà extraites du fichier Excel).
 * Module pur, sans base de données : testé unitairement.
 * Deux modes : créateur (son catalogue) et admin (toute la boutique : colonne Marque,
 * statut et nom SumUp modifiables).
 */
import { parseEurosToCents } from "./money";
import { normalizeReference } from "./reference";

export const SHEET_COLUMNS = {
  brand: "Marque",
  code: "Identifiant (ne pas modifier)",
  reference: "Référence",
  name: "Nom",
  price: "Prix (€)",
  quantity: "Quantité",
  status: "Statut",
  sumupName: "Nom dans la caisse SumUp",
} as const;

type ColKey = keyof typeof SHEET_COLUMNS;

export const MAX_IMPORT_ROWS = 500;
export const MAX_ADMIN_IMPORT_ROWS = 5000;

/** Libellés de statut acceptés (sans accents ni casse) → valeur stockée. */
const STATUS_BY_LABEL: Record<string, string> = {
  actif: "ACTIVE",
  active: "ACTIVE",
  enattente: "PENDING",
  attente: "PENDING",
  refuse: "REJECTED",
  archive: "ARCHIVED",
};

export type SheetRow = {
  line: number; // numéro de ligne Excel (1 = en-tête)
  code: string | null;
  reference: string;
  name: string;
  priceCents: number;
  quantity: number | null; // null = cellule vide (stock inchangé pour un produit existant)
  /** Mode admin uniquement. */
  brand?: string;
  /** Mode admin : statut demandé ; undefined = inchangé. */
  status?: string;
  /** Mode admin : undefined = colonne absente (inchangé), null = cellule vide (nom par défaut). */
  sumupName?: string | null;
};

export type SheetError = { line: number; message: string };

export function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_KEYS: Record<string, ColKey> = {
  marque: "brand",
  createur: "brand",
  identifiant: "code",
  reference: "reference",
  ref: "reference",
  nom: "name",
  nomduproduit: "name",
  prix: "price",
  quantite: "quantity",
  stock: "quantity",
  statut: "status",
  nomdanslacaissesumup: "sumupName",
  nomsumup: "sumupName",
};

/** Valeur brute d'une cellule (exceljs : nombre, texte, texte riche, formule, lien…) → texte ou nombre. */
export function cellValue(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (Array.isArray(o.richText)) return cellValue(o.richText.map((r) => r.text).join(""));
    if ("result" in o) return cellValue(o.result);
    if (typeof o.text === "string") return cellValue(o.text);
  }
  return cellValue(String(v));
}

function toText(v: string | number | null) {
  return v == null ? "" : String(v).trim();
}

/**
 * rows[0] = en-tête. Retourne les lignes valides et les erreurs (numéro de ligne Excel).
 */
export function readProductRows(
  rows: (string | number | null)[][],
  opts: { admin?: boolean } = {},
): { rows: SheetRow[]; errors: SheetError[] } {
  const admin = !!opts.admin;
  const errors: SheetError[] = [];
  const header = rows[0] ?? [];
  const col: Partial<Record<ColKey, number>> = {};
  header.forEach((h, i) => {
    const key = HEADER_KEYS[norm(toText(h))];
    if (key && col[key] === undefined) col[key] = i;
  });
  const required: ColKey[] = admin ? ["brand", "reference", "name", "price"] : ["reference", "name", "price"];
  const missing = required.filter((k) => col[k] === undefined);
  if (missing.length)
    return {
      rows: [],
      errors: [{ line: 1, message: `Colonnes manquantes : ${missing.map((k) => SHEET_COLUMNS[k]).join(", ")}. Partez du fichier exporté.` }],
    };

  const maxRows = admin ? MAX_ADMIN_IMPORT_ROWS : MAX_IMPORT_ROWS;
  const out: SheetRow[] = [];
  const dataRows = rows.slice(1);
  if (dataRows.filter((r) => r.some((c) => c != null && toText(c) !== "")).length > maxRows)
    return { rows: [], errors: [{ line: 1, message: `${maxRows} produits maximum par import.` }] };

  dataRows.forEach((r, idx) => {
    const line = idx + 2;
    const get = (k: ColKey) => (col[k] === undefined ? null : (r[col[k]!] ?? null));
    const watched: ColKey[] = ["code", "reference", "name", "price", "quantity", ...(admin ? (["brand"] as ColKey[]) : [])];
    if (!watched.some((k) => toText(get(k)) !== "")) return;

    const lineErrors: string[] = [];
    const codeRaw = toText(get("code"));
    const code = codeRaw ? (/^\d+$/.test(codeRaw) ? codeRaw.padStart(3, "0") : codeRaw) : null;

    const brand = admin ? toText(get("brand")) : undefined;
    if (admin && !brand) lineErrors.push("Marque manquante.");

    const ref = normalizeReference(get("reference"));
    if ("error" in ref) lineErrors.push(ref.error);

    const name = toText(get("name"));
    if (name.length < 2) lineErrors.push("Nom manquant ou trop court.");
    else if (name.length > 120) lineErrors.push("Nom trop long (120 caractères maximum).");

    const priceRaw = get("price");
    const priceCents =
      typeof priceRaw === "number" ? Math.round(priceRaw * 100) : priceRaw == null ? null : parseEurosToCents(String(priceRaw));
    if (priceCents === null || priceCents <= 0) lineErrors.push("Prix manquant ou invalide.");

    const qRaw = get("quantity");
    let quantity: number | null = null;
    if (toText(qRaw) !== "") {
      const q = typeof qRaw === "number" ? qRaw : Number(String(qRaw).replace(",", "."));
      if (!Number.isInteger(q) || q < 0 || q > 10000) lineErrors.push("Quantité invalide (nombre entier entre 0 et 10 000).");
      else quantity = q;
    }

    let status: string | undefined;
    let sumupName: string | null | undefined;
    if (admin) {
      const s = toText(get("status"));
      if (s) {
        status = STATUS_BY_LABEL[norm(s)];
        if (!status) lineErrors.push(`Statut « ${s} » inconnu (Actif, En attente, Refusé ou Archivé).`);
      }
      if (col.sumupName !== undefined) {
        const sn = toText(get("sumupName"));
        if (sn.length > 160) lineErrors.push("Nom SumUp trop long (160 caractères maximum).");
        sumupName = sn || null;
      }
    }

    if (lineErrors.length) errors.push({ line, message: lineErrors.join(" ") });
    else
      out.push({
        line,
        code,
        reference: (ref as { value: string }).value,
        name,
        priceCents: priceCents!,
        quantity,
        ...(admin ? { brand, status, sumupName } : {}),
      });
  });

  // Doublons dans le fichier (par marque en mode admin)
  const seen = new Map<string, number>();
  for (const r of out) {
    const scope = admin ? `${norm(r.brand ?? "")}|` : "";
    for (const key of [r.code ? `code:${scope}${r.code}` : null, `ref:${scope}${r.reference}`]) {
      if (!key) continue;
      const first = seen.get(key);
      if (first)
        errors.push({
          line: r.line,
          message: `${key.startsWith("ref:") ? `Référence ${r.reference}` : `Identifiant ${r.code}`} en double${admin ? ` pour ${r.brand}` : ""} (déjà ligne ${first}).`,
        });
      else seen.set(key, r.line);
    }
  }
  return { rows: out, errors: errors.sort((a, b) => a.line - b.line) };
}
