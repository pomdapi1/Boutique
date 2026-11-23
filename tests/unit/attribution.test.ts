import { describe, expect, it } from "vitest";
import { buildMatcher, canonicalSumupName, normalize, parseLabel, type MatchableProduct } from "@/lib/attribution";

const products: MatchableProduct[] = [
  { id: "p1", code: "012", name: "Pot de fleurs (petit)", sumupName: null, creatorId: "c1", creatorName: "Le jardin du crochet" },
  { id: "p2", code: "012", name: "Sticker fleur", sumupName: null, creatorId: "c2", creatorName: "Sarradeuxairs" },
  { id: "p3", code: "044", name: "Bague réglable", sumupName: "Bague ajustable dorée", creatorId: "c3", creatorName: "Baldck" },
];
const match = buildMatcher(products);

describe("normalize", () => {
  it("ignore accents, casse et type de tiret", () => {
    expect(normalize("012 — Pot de Fleurs – Le Jardin")).toBe(normalize("012 - pot de fleurs - le jardin"));
    expect(normalize("Naimé")).toBe("naime");
  });
});

describe("parseLabel", () => {
  it("extrait code et créateur", () => {
    expect(parseLabel("012 - Pot de fleurs (petit) - Le jardin du crochet")).toEqual({ code: "012", creator: "le jardin du crochet" });
    expect(parseLabel("Carte cadeau")).toEqual({ code: null, creator: null });
  });
});

describe("buildMatcher", () => {
  it("nom canonique exact", () => {
    expect(match(canonicalSumupName({ ...products[0]!, creatorName: "Le jardin du crochet" })).product?.id).toBe("p1");
  });

  it("même code chez deux créateurs : départage par le créateur", () => {
    expect(match("012 - Sticker fleur - Sarradeuxairs").product?.id).toBe("p2");
    expect(match("012 — Pot de fleurs (petit) — Le jardin du crochet").product?.id).toBe("p1");
  });

  it("nom modifié dans SumUp mais code + créateur reconnus", () => {
    expect(match("12 - Pot fleurs - le jardin du crochet").product?.id).toBe("p1");
  });

  it("nom SumUp personnalisé (sumupName)", () => {
    expect(match("bague ajustable dorée").product?.id).toBe("p3");
  });

  it("créateur reconnu mais produit inconnu : attribué au créateur seulement", () => {
    expect(match("999 - Nouveau - Baldck")).toEqual({ product: null, creatorId: "c3" });
  });

  it("convention SumUp « Marque - Nom » (casse, accents, tirets indifférents)", () => {
    expect(canonicalSumupName({ name: "Sticker fleur", creatorName: "Sarradeuxairs" })).toBe("Sarradeuxairs - Sticker fleur");
    expect(match("SARRADEUXAIRS – sticker fleur").product?.id).toBe("p2");
    expect(match("Le jardin du crochet - Pot de fleurs (petit)").product?.id).toBe("p1");
    expect(match("Baldck - Produit inconnu")).toEqual({ product: null, creatorId: "c3" });
  });

  it("marque contenant elle-même un tiret", () => {
    const m = buildMatcher([{ id: "x", code: "001", name: "Bougie", sumupName: null, creatorId: "cx", creatorName: "Atelier - Paulette" }]);
    expect(m("Atelier - Paulette - Bougie").product?.id).toBe("x");
  });

  it("libellé inconnu : non attribué", () => {
    expect(match("Porte clef moyen crochet")).toEqual({ product: null, creatorId: null });
  });
});
