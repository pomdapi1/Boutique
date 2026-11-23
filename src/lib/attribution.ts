/**
 * Attribution d'une ligne de vente SumUp à un produit / créateur.
 *
 * Convention de nommage des articles dans la caisse SumUp (comme le CSV SumUp) :
 *   "P'TITE CREVETTE - Maxi Chouchou"   (Marque - Nom)
 * Ancienne convention, toujours reconnue :
 *   "012 - Pot de fleurs (petit) - Le jardin du crochet"   (code - Nom - Marque)
 * (le séparateur peut être "-", "–" ou "—" ; casse et accents ignorés).
 *
 * Ordre de résolution :
 *  1. nom exact : sumupName du produit, nom par défaut « Marque - Nom » ou ancien « code - Nom - Marque » ;
 *  2. « Marque - Nom » : marque = premier segment, produit retrouvé par son nom ;
 *  3. « code - … - Marque » : marque = dernier segment, produit retrouvé par son code ;
 *  4. sinon, si une marque est reconnue, la vente lui est attribuée sans produit.
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

/** Nom par défaut de l'article dans la caisse SumUp : « Marque - Nom ». */
export function canonicalSumupName(p: { name: string; creatorName: string; code?: string }): string {
  return `${p.creatorName} - ${p.name}`;
}

/** Ancien nom par défaut (« 012 - Nom - Marque »), toujours reconnu à l'import des ventes. */
export function legacySumupName(p: { code: string; name: string; creatorName: string }): string {
  return `${p.code} - ${p.name} - ${p.creatorName}`;
}

export function parseLabel(label: string): { code: string | null; creator: string | null } {
  const parts = normalize(label).split(" - ");
  const code = /^\d{1,4}$/.test(parts[0] ?? "") ? parts[0]! : null;
  const creator = parts.length >= 2 ? parts[parts.length - 1]! : null;
  return { code, creator };
}

export function buildMatcher(products: MatchableProduct[]) {
  const byName = new Map<string, MatchableProduct>();
  const byCreatorCode = new Map<string, MatchableProduct>();
  const byCreatorProductName = new Map<string, MatchableProduct>();
  const creatorsByName = new Map<string, string>();

  for (const p of products) {
    byName.set(normalize(legacySumupName(p)), p);
    byName.set(normalize(canonicalSumupName(p)), p);
    if (p.sumupName) byName.set(normalize(p.sumupName), p);
    const cn = normalize(p.creatorName);
    creatorsByName.set(cn, p.creatorId);
    byCreatorCode.set(`${cn}|${p.code.replace(/^0+/, "")}`, p);
    byCreatorProductName.set(`${cn}|${normalize(p.name)}`, p);
  }

  return function match(label: string): { product: MatchableProduct | null; creatorId: string | null } {
    const exact = byName.get(normalize(label));
    if (exact) return { product: exact, creatorId: exact.creatorId };

    const parts = normalize(label).split(" - ");
    if (parts.length >= 2) {
      // « Marque - Nom » (la marque peut elle-même contenir « - »)
      for (let i = 1; i < parts.length; i++) {
        const brand = parts.slice(0, i).join(" - ");
        const creatorId = creatorsByName.get(brand);
        if (creatorId) {
          const p = byCreatorProductName.get(`${brand}|${parts.slice(i).join(" - ")}`);
          return { product: p ?? null, creatorId };
        }
      }
      // « code - … - Marque »
      const { code, creator } = parseLabel(label);
      const lastCreator = creator ? creatorsByName.get(creator) : undefined;
      if (lastCreator) {
        const p = code ? byCreatorCode.get(`${creator}|${code.replace(/^0+/, "")}`) : undefined;
        return { product: p ?? null, creatorId: lastCreator };
      }
    }
    return { product: null, creatorId: null };
  };
}
