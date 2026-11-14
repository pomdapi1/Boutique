/**
 * Référence produit saisie par le créateur (ex. "pot-petit-01" → "POT-PETIT-01").
 * Normalisée en majuscules pour que "bag-01" et "BAG-01" soient la même référence.
 */
export function normalizeReference(input: unknown): { value: string } | { error: string } {
  const raw = String(input ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  if (!raw) return { error: "La référence produit est obligatoire." };
  if (raw.length > 40) return { error: "Référence trop longue (40 caractères maximum)." };
  if (!/^[A-Z0-9][A-Z0-9 ._\-/]*$/.test(raw))
    return { error: "Référence : lettres sans accent, chiffres, tirets, points ou barres uniquement." };
  return { value: raw };
}
