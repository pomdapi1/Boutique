/**
 * Attribution d'une ligne de vente SumUp à un produit / créateur.
 *
 * Convention de nommage des articles dans la caisse SumUp :
 *   "012 - Pot de fleurs (petit) - Le jardin du crochet"
 * (le séparateur peut être "-", "–" ou "—").
 *
 * Ordre de résolution :
 *  1. nom SumUp exact du produit (champ sumupName, ou nom canonique généré) ;
 *  2. créateur = dernier segment, code = premier segment numérique.
 */

export type MatchableProduct = {
  id: string;
  code: string;
  name: string;
  sumupName: string | null;
  creatorId: string;
  creatorName: string;
};

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalSumupName(p: { code: string; name: string; creatorName: string }): string {
  return `${p.code} - ${p.name} - ${p.creatorName}`;
}

export function parseLabel(label: string): { code: string | null; creator: string | null } {
  const parts = normalize(label).split(" - ");
  const code = /^\d{1,4}$/.test(parts[0] ?? "") ? parts[0] : null;
  const creator = parts.length >= 2 ? parts[parts.length - 1] : null;
  return { code, creator };
}

export function buildMatcher(products: MatchableProduct[]) {
  const byName = new Map<string, MatchableProduct>();
  const byCreatorCode = new Map<string, MatchableProduct>();
  const creatorsByName = new Map<string, string>();

  for (const p of products) {
    byName.set(normalize(canonicalSumupName(p)), p);
    if (p.sumupName) byName.set(normalize(p.sumupName), p);
    const cn = normalize(p.creatorName);
    creatorsByName.set(cn, p.creatorId);
    byCreatorCode.set(`${cn}|${p.code.replace(/^0+/, "")}`, p);
  }

  return function match(label: string): { product: MatchableProduct | null; creatorId: string | null } {
    const exact = byName.get(normalize(label));
    if (exact) return { product: exact, creatorId: exact.creatorId };

    const { code, creator } = parseLabel(label);
    if (creator) {
      const creatorId = creatorsByName.get(creator) ?? null;
      if (creatorId && code) {
        const p = byCreatorCode.get(`${creator}|${code.replace(/^0+/, "")}`);
        if (p) return { product: p, creatorId };
      }
      if (creatorId) return { product: null, creatorId };
    }
    return { product: null, creatorId: null };
  };
}
