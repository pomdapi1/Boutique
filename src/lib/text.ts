/** Retours à la ligne unifiés (le navigateur envoie \r\n) et espaces de bord retirés. */
export function normalizeText(input: unknown): string {
  return String(input ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

/**
 * Texte qui serait interprété comme une formule par Excel / LibreOffice à l'ouverture
 * d'un export CSV (injection de formule). Refusé à la saisie plutôt que modifié à l'export,
 * pour que les noms restent identiques à ceux de la caisse SumUp.
 */
export function looksLikeFormula(s: string): boolean {
  return /^[=+\-@\t\r]/.test(s.trim());
}

/** Message d'erreur commun ; `what` = « Le nom », « La catégorie »… */
export function formulaError(what: string): string {
  return `${what} ne doit pas commencer par =, +, - ou @ (risque de formule à l'ouverture dans Excel).`;
}

/** Nombre de caractères tel qu'un humain le compte (un emoji = 1). */
export function charCount(s: string): number {
  return Array.from(s).length;
}
