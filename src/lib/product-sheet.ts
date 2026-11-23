/**
 * Format d'échange des produits : modèle CSV d'articles SumUp (import / export de la caisse).
 * Module pur, sans base de données : testé unitairement.
 *
 * Colonnes utilisées : Item name, Variations, Price, Track inventory?, Quantity, SKU,
 * Category, Item id, Variant id. Les autres colonnes SumUp sont écrites à l'export
 * (valeurs par défaut) et ignorées à l'import.
 */
import { parseEurosToCents } from "./money";
import { normalizeReference } from "./reference";

/** En-têtes exacts du modèle CSV d'articles SumUp, dans l'ordre. */
export const SUMUP_HEADERS = [
  "Item name",
  "Variations",
  "Option set 1",
  "Option 1",
  "Option set 2",
  "Option 2",
  "Option set 3",
  "Option 3",
  "Option set 4",
  "Option 4",
  "Is variation visible? (Yes/No)",
  "Price",
  "Cost price",
  "Variable price? (Yes/No)",
  "Tax rate (%)",
  "On sale in Online Store?",
  "Regular price (before sale)",
  "Set up different prices and VAT for takeaway",
  "Takeaway price",
  "Takeaway tax rate",
  "Unit",
  "Track inventory? (Yes/No)",
  "Quantity",
  "Low stock threshold",
  "SKU",
  "Barcode",
  "Modifiers",
  "Description (Online Store and Invoices only)",
  "Category",
  "Display item at Checkout? (Yes/No)",
  "Display colour in POS checkout",
  "Image 1",
  "Image 2",
  "Image 3",
  "Image 4",
  "Image 5",
  "Image 6",
  "Image 7",
  "Display item in Online Store? (Yes/No)",
  "SEO title (Online Store only)",
  "SEO description (Online Store only)",
  "Shipping weight [kg] (Online Store only)",
  "Display service in Bookings? (Yes/No)",
  "Duration [minutes] (Bookings only)",
  "Location [business/customer] (Bookings only)",
  "Item id (Do not change)",
  "Variant id (Do not change)",
] as const;

export type SumUpHeader = (typeof SUMUP_HEADERS)[number];

export const MAX_IMPORT_ROWS = 500;
export const MAX_ADMIN_IMPORT_ROWS = 5000;

export type SheetRow = {
  line: number; // numéro de ligne du fichier (1 = en-tête)
  itemName: string; // nom de l'article dans la caisse (« Marque - Nom »)
  brand: string | null; // colonne Category (= marque), null si vide
  reference: string; // colonne SKU, normalisée
  priceCents: number;
  quantity: number | null; // null = stock non suivi ou cellule vide (inchangé)
  itemId: string | null;
  variantId: string | null;
};

export type SheetError = { line: number; message: string };

export function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const COLS = {
  itemName: "Item name",
  variations: "Variations",
  price: "Price",
  track: "Track inventory? (Yes/No)",
  quantity: "Quantity",
  sku: "SKU",
  category: "Category",
  itemId: "Item id (Do not change)",
  variantId: "Variant id (Do not change)",
} as const satisfies Record<string, SumUpHeader>;

type ColKey = keyof typeof COLS;

/** En-têtes acceptés en plus des en-têtes SumUp (fichier retravaillé à la main). */
const ALIASES: Record<string, ColKey> = {
  nom: "itemName",
  prix: "price",
  quantite: "quantity",
  stock: "quantity",
  reference: "sku",
  marque: "category",
  categorie: "category",
};

/**
 * Nom du produit à partir du nom d'article SumUp :
 * « Marque - Nom » → « Nom » ; ancien « 012 - Nom - Marque » → « Nom » ; sinon le nom tel quel.
 */
export function productNameFromItemName(itemName: string, brand: string): string {
  const name = itemName.trim();
  const nb = norm(brand);
  // Séparateurs « tiret entouré d'espaces » (les tirets dans les mots, ex. « Porte-clefs », sont conservés)
  const seps = [...name.matchAll(/\s+[-–—]\s+/g)];
  for (const m of seps) {
    if (norm(name.slice(0, m.index)) === nb) return name.slice(m.index! + m[0].length).trim();
  }
  // Ancien format « 012 - Nom - Marque »
  if (seps.length >= 2 && /^\d{1,4}$/.test(name.slice(0, seps[0]!.index)) && norm(name.slice(seps.at(-1)!.index! + seps.at(-1)![0].length)) === nb)
    return name.slice(seps[0]!.index! + seps[0]![0].length, seps.at(-1)!.index).trim();
  return name;
}

/** rows[0] = en-tête. Retourne les lignes valides et les erreurs (numéro de ligne du fichier). */
export function readProductRows(rows: string[][], opts: { admin?: boolean } = {}): { rows: SheetRow[]; errors: SheetError[] } {
  const errors: SheetError[] = [];
  const header = rows[0] ?? [];
  const col: Partial<Record<ColKey, number>> = {};
  const byNorm = new Map(Object.entries(COLS).map(([k, h]) => [norm(h), k as ColKey]));
  header.forEach((h, i) => {
    const key = byNorm.get(norm(h)) ?? ALIASES[norm(h)];
    if (key && col[key] === undefined) col[key] = i;
  });
  const missing = (["itemName", "price", "sku"] as const).filter((k) => col[k] === undefined);
  if (missing.length)
    return {
      rows: [],
      errors: [{ line: 1, message: `Colonnes manquantes : ${missing.map((k) => COLS[k]).join(", ")}. Partez du fichier exporté (format CSV SumUp).` }],
    };

  const maxRows = opts.admin ? MAX_ADMIN_IMPORT_ROWS : MAX_IMPORT_ROWS;
  const dataRows = rows.slice(1);
  if (dataRows.filter((r) => r.some((c) => c.trim() !== "")).length > maxRows)
    return { rows: [], errors: [{ line: 1, message: `${maxRows} produits maximum par import.` }] };

  const out: SheetRow[] = [];
  dataRows.forEach((r, idx) => {
    const line = idx + 2;
    const get = (k: ColKey) => (col[k] === undefined ? "" : (r[col[k]!] ?? "").trim());
    if (!r.some((c) => c.trim() !== "")) return;

    const lineErrors: string[] = [];
    const itemName = get("itemName");
    if (itemName.length < 2) lineErrors.push("Item name (nom de l'article) manquant.");
    else if (itemName.length > 160) lineErrors.push("Item name trop long (160 caractères maximum).");

    if (get("variations")) lineErrors.push("Les variantes SumUp ne sont pas gérées : une ligne par produit.");

    const ref = normalizeReference(get("sku"));
    if ("error" in ref) lineErrors.push(`SKU : ${ref.error.replace(/^La référence produit est obligatoire\.$/, "obligatoire (référence du produit).")}`);

    const priceCents = parseEurosToCents(get("price"));
    if (priceCents === null || priceCents <= 0) lineErrors.push("Price (prix) manquant ou invalide.");

    let quantity: number | null = null;
    const tracked = norm(get("track")) !== "no" && norm(get("track")) !== "non";
    const qRaw = get("quantity");
    if (tracked && qRaw !== "") {
      const q = Number(qRaw.replace(",", "."));
      if (!Number.isInteger(q) || q < 0 || q > 10000) lineErrors.push("Quantity invalide (nombre entier entre 0 et 10 000).");
      else quantity = q;
    }

    if (lineErrors.length) errors.push({ line, message: lineErrors.join(" ") });
    else
      out.push({
        line,
        itemName,
        brand: get("category") || null,
        reference: (ref as { value: string }).value,
        priceCents: priceCents!,
        quantity,
        itemId: get("itemId") || null,
        variantId: get("variantId") || null,
      });
  });

  // Doublons dans le fichier : SKU par marque, Item id
  const seen = new Map<string, number>();
  for (const r of out) {
    const keys = [`sku:${norm(r.brand ?? "")}|${r.reference}`, r.itemId ? `id:${r.itemId}` : null];
    for (const key of keys) {
      if (!key) continue;
      const first = seen.get(key);
      if (first)
        errors.push({
          line: r.line,
          message: key.startsWith("sku:") ? `SKU ${r.reference} en double (déjà ligne ${first}).` : `Item id en double (déjà ligne ${first}).`,
        });
      else seen.set(key, r.line);
    }
  }
  return { rows: out, errors: errors.sort((a, b) => a.line - b.line) };
}

/** Ligne CSV SumUp d'un produit (valeurs par défaut pour les colonnes non gérées). */
export function sumupCsvRow(p: {
  itemName: string;
  brand: string;
  reference: string | null;
  priceCents: number;
  stock: number;
  visible: boolean;
  vatRate: number;
  itemId: string | null;
  variantId: string | null;
}): string[] {
  const values: Partial<Record<SumUpHeader, string>> = {
    "Item name": p.itemName,
    "Is variation visible? (Yes/No)": "Yes",
    Price: (p.priceCents / 100).toFixed(2),
    "Variable price? (Yes/No)": "No",
    "Tax rate (%)": p.vatRate.toFixed(2),
    "On sale in Online Store?": "No",
    "Set up different prices and VAT for takeaway": "No",
    Unit: "each.each",
    "Track inventory? (Yes/No)": "Yes",
    Quantity: String(p.stock),
    "Low stock threshold": "0",
    SKU: p.reference ?? "",
    Category: p.brand,
    "Display item at Checkout? (Yes/No)": p.visible ? "Yes" : "No",
    "Display item in Online Store? (Yes/No)": "No",
    "Display service in Bookings? (Yes/No)": "No",
    "Item id (Do not change)": p.itemId ?? "",
    "Variant id (Do not change)": p.variantId ?? "",
  };
  return SUMUP_HEADERS.map((h) => values[h] ?? "");
}
