/**
 * Lecture d'un tableau de produits (lignes déjà extraites du fichier Excel).
 * Module pur, sans base de données : testé unitairement.
 */
import { parseEurosToCents } from "./money";
import { normalizeReference } from "./reference";

export const SHEET_COLUMNS = {
  code: "Identifiant (ne pas modifier)",
  reference: "Référence",
  name: "Nom",
  price: "Prix (€)",
  quantity: "Quantité",
  status: "Statut",
} as const;

export const MAX_IMPORT_ROWS = 500;

export type SheetRow = {
  line: number; // numéro de ligne Excel (1 = en-tête)
  code: string | null;
  reference: string;
  name: string;
  priceCents: number;
  quantity: number | null; // null = cellule vide (stock inchangé pour un produit existant)
};

export type SheetError = { line: number; message: string };

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z]/g, "");
}

const HEADER_KEYS: Record<string, keyof typeof SHEET_COLUMNS> = {
  identifiant: "code",
  reference: "reference",
  ref: "reference",
  nom: "name",
  nomduproduit: "name",
  prix: "price",
  quantite: "quantity",
  stock: "quantity",
  statut: "status",
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
export function readProductRows(rows: (string | number | null)[][]): { rows: SheetRow[]; errors: SheetError[] } {
  const errors: SheetError[] = [];
  const header = rows[0] ?? [];
  const col: Partial<Record<keyof typeof SHEET_COLUMNS, number>> = {};
  header.forEach((h, i) => {
    const key = HEADER_KEYS[norm(toText(h))];
    if (key && col[key] === undefined) col[key] = i;
  });
  const missing = (["reference", "name", "price"] as const).filter((k) => col[k] === undefined);
  if (missing.length)
    return {
      rows: [],
      errors: [{ line: 1, message: `Colonnes manquantes : ${missing.map((k) => SHEET_COLUMNS[k]).join(", ")}. Partez du fichier exporté.` }],
    };

  const out: SheetRow[] = [];
  const dataRows = rows.slice(1);
  if (dataRows.filter((r) => r.some((c) => c != null && toText(c) !== "")).length > MAX_IMPORT_ROWS)
    return { rows: [], errors: [{ line: 1, message: `${MAX_IMPORT_ROWS} produits maximum par import.` }] };

  dataRows.forEach((r, idx) => {
    const line = idx + 2;
    const get = (k: keyof typeof SHEET_COLUMNS) => (col[k] === undefined ? null : (r[col[k]!] ?? null));
    if (![get("code"), get("reference"), get("name"), get("price"), get("quantity")].some((c) => toText(c) !== "")) return;

    const lineErrors: string[] = [];
    const codeRaw = toText(get("code"));
    const code = codeRaw ? (/^\d+$/.test(codeRaw) ? codeRaw.padStart(3, "0") : codeRaw) : null;

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

    if (lineErrors.length) errors.push({ line, message: lineErrors.join(" ") });
    else out.push({ line, code, reference: (ref as { value: string }).value, name, priceCents: priceCents!, quantity });
  });

  // Doublons dans le fichier
  const seen = new Map<string, number>();
  for (const r of out) {
    for (const key of [r.code ? `code:${r.code}` : null, `ref:${r.reference}`]) {
      if (!key) continue;
      const first = seen.get(key);
      if (first) errors.push({ line: r.line, message: `${key.startsWith("ref:") ? `Référence ${r.reference}` : `Identifiant ${r.code}`} en double (déjà ligne ${first}).` });
      else seen.set(key, r.line);
    }
  }
  return { rows: out, errors: errors.sort((a, b) => a.line - b.line) };
}
