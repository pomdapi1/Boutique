export const ROLES = { ADMIN: "ADMIN", CREATOR: "CREATOR" } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PRODUCT_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  ARCHIVED: "ARCHIVED",
} as const;

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  REJECTED: "Refusé",
  ARCHIVED: "Archivé",
};

export const PAYMENT_LABEL: Record<string, string> = {
  CARD: "Carte",
  CASH: "Espèces",
  OTHER: "Autre",
};

export const STOCK_REASON_LABEL: Record<string, string> = {
  SALE: "Vente",
  REFUND: "Remboursement",
  RESTOCK: "Réassort",
  REMOVAL: "Retrait",
  CORRECTION: "Correction",
};

export type DocumentTypeConfig = {
  type: string;
  label: string;
  max: number;
  mimeTypes: string[];
  hint: string;
};

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

const PDF = ["application/pdf"];
const PDF_IMG = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  { type: "RIB", label: "RIB", max: 1, mimeTypes: PDF_IMG, hint: "1 maximum, PDF ou image — max 2 Mo" },
  { type: "RC_PRO", label: "RC Pro", max: 1, mimeTypes: PDF, hint: "1 maximum, PDF — max 2 Mo" },
  { type: "KBIS", label: "Justificatif d'immatriculation", max: 1, mimeTypes: PDF, hint: "1 maximum, PDF — max 2 Mo" },
];

/** Photos de communication (section « Communication », hors documents administratifs). */
export const PHOTO_TYPE: DocumentTypeConfig = {
  type: "PHOTO",
  label: "Photos",
  max: 5,
  mimeTypes: ["image/jpeg", "image/png"],
  hint: "Merci d'insérer 4 photos de vos produits et une photo de vous si désiré. Merci de compresser vos photos si elles sont trop lourdes. — JPEG ou PNG, 2 Mo max par photo.",
};

export function findDocumentType(type: string): DocumentTypeConfig | undefined {
  return type === PHOTO_TYPE.type ? PHOTO_TYPE : DOCUMENT_TYPES.find((t) => t.type === type);
}

/** Taux de TVA acceptés par SumUp (colonne « Tax rate (%) ») ; null = non applicable. */
export const VAT_RATES = [0, 5, 10, 15, 20] as const;
export const VAT_HINT = "Valeurs acceptées par SumUp : vide (non applicable), 0 %, 5 %, 10 %, 15 %, 20 %.";

export function vatLabel(rate: number | null): string {
  return rate === null ? "TVA non applicable" : `TVA ${rate} %`;
}

/** Valeur saisie (formulaire ou CSV) → taux autorisé, null (non applicable) ou erreur. "" = non applicable. */
export function parseVatRate(input: unknown): { value: number | null } | { error: string } {
  const raw = String(input ?? "").trim().replace("%", "").replace(",", ".").trim();
  if (raw === "") return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || !(VAT_RATES as readonly number[]).includes(n)) return { error: `TVA « ${String(input).trim()} » refusée. ${VAT_HINT}` };
  return { value: n };
}

export const BRAND_PITCH_MAX = 300;
export const SALES_NOTES_MAX = 1500;

export const DEFAULT_COMMISSION_RATE = 0.3;
// Taux de frais SumUp utilisé uniquement si SumUp ne renvoie pas fee_amount
// (et pour les ventes simulées). Modifiable dans Admin > Paramètres.
export const DEFAULT_CARD_FEE_RATE = 0.0175;
