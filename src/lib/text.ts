/** Retours à la ligne unifiés (le navigateur envoie \r\n) et espaces de bord retirés. */
export function normalizeText(input: unknown): string {
  return String(input ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

/** Nombre de caractères tel qu'un humain le compte (un emoji = 1). */
export function charCount(s: string): number {
  return Array.from(s).length;
}
