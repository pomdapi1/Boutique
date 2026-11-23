import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { productNameFromItemName, readProductRows, sumupCsvRow, SUMUP_HEADERS } from "@/lib/product-sheet";

// Extrait du fichier d'exemple SumUp fourni (PTITE_CREVETTE_SumUp_TVA20_EXEMPLE.csv)
const SUMUP_SAMPLE = `${SUMUP_HEADERS.join(",")}
P'TITE CREVETTE - Maxi Chouchou,,,,,,,,,,Yes,9.00,,No,20.00,No,,No,,,each.each,Yes,17,0,PC001,,,,P'TITE CREVETTE,Yes,,,,,,,,,No,,,,No,,,7126258a-ad57-4e2c-942d-f97ff75af774,f7922f8e-3db3-4f8e-8b7d-09b191029476
P'TITE CREVETTE - Barrette NŒUD,,,,,,,,,,Yes,12.00,,No,20.00,No,,No,,,each.each,Yes,7,0,PC006,,,,P'TITE CREVETTE,Yes,,,,,,,,,No,,,,No,,,1f33784d-d988-45b7-bce4-f2e487ad5e3c,83df6a4b-e4f4-470b-b42f-dfb18a0ec41c
`;

describe("readProductRows (CSV SumUp)", () => {
  it("lit le fichier d'exemple SumUp", () => {
    const { rows, errors } = readProductRows(parseCsv(SUMUP_SAMPLE));
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      line: 2,
      itemName: "P'TITE CREVETTE - Maxi Chouchou",
      brand: "P'TITE CREVETTE",
      reference: "PC001",
      priceCents: 900,
      quantity: 17,
      vatRate: 20,
      itemId: "7126258a-ad57-4e2c-942d-f97ff75af774",
      variantId: "f7922f8e-3db3-4f8e-8b7d-09b191029476",
    });
    expect(rows[1]!.itemName).toBe("P'TITE CREVETTE - Barrette NŒUD");
  });

  it("accepte un fichier réenregistré par Excel (point-virgule, virgule décimale)", () => {
    const { rows, errors } = readProductRows(parseCsv("Item name;Price;SKU;Quantity;Category\nBaldck - Bague;18,50;bag-1;3;Baldck\n"));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ reference: "BAG-1", priceCents: 1850, quantity: 3, brand: "Baldck" });
  });

  it("stock non suivi (Track inventory = No) ou vide : quantité inchangée", () => {
    const { rows } = readProductRows([
      ["Item name", "Price", "SKU", "Track inventory? (Yes/No)", "Quantity"],
      ["A - Un", "5", "A1", "No", "12"],
      ["A - Deux", "5", "A2", "Yes", ""],
    ]);
    expect(rows.map((r) => r.quantity)).toEqual([null, null]);
  });

  it("signale les erreurs ligne par ligne (SKU, prix, quantité, variantes)", () => {
    const { rows, errors } = readProductRows([
      ["Item name", "Variations", "Price", "SKU", "Quantity"],
      ["A - Sans SKU", "", "10", "", "1"],
      ["A - Variante", "Taille", "10", "V1", "1"],
      ["A - Mauvais", "", "-2", "M1", "1.5"],
    ]);
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(errors[0]!.message).toMatch(/SKU/);
    expect(errors[1]!.message).toMatch(/variantes/);
    expect(errors[2]!.message).toMatch(/Price.*Quantity/);
  });

  it("détecte SKU (par marque) et Item id en double", () => {
    const { errors } = readProductRows([
      ["Item name", "Price", "SKU", "Category", "Item id (Do not change)"],
      ["A - Un", "1", "R1", "A", "id-1"],
      ["A - Deux", "1", "r1", "A", "id-1"],
      ["B - Trois", "1", "R1", "B", ""],
    ]);
    expect(errors.map((e) => e.message)).toEqual(["SKU R1 en double (déjà ligne 2).", "Item id en double (déjà ligne 2)."]);
  });

  it("Tax rate (%) : vide = non applicable, valeurs SumUp acceptées, autres refusées", () => {
    const { rows, errors } = readProductRows([
      ["Item name", "Price", "SKU", "Tax rate (%)"],
      ["A - Un", "5", "A1", ""],
      ["A - Deux", "5", "A2", "10.00"],
      ["A - Trois", "5", "A3", "5.5"],
    ]);
    expect(rows.map((r) => r.vatRate)).toEqual([null, 10]);
    expect(errors[0]!.message).toMatch(/Tax rate.*5\.5.*vide \(non applicable\), 0 %, 5 %, 10 %, 15 %, 20 %/);
  });

  it("colonne Tax rate absente : TVA inchangée (undefined)", () => {
    const { rows } = readProductRows([["Item name", "Price", "SKU"], ["A - Un", "5", "A1"]]);
    expect(rows[0]!.vatRate).toBeUndefined();
  });

  it("refuse un fichier sans les colonnes obligatoires", () => {
    expect(readProductRows([["Nom", "Prix"]]).errors[0]!.message).toMatch(/Colonnes manquantes : SKU/);
  });
});

describe("productNameFromItemName", () => {
  it("retire la marque en tête, garde les tirets internes", () => {
    expect(productNameFromItemName("P'TITE CREVETTE - Maxi Chouchou", "P'TITE CREVETTE")).toBe("Maxi Chouchou");
    expect(productNameFromItemName("le jardin du crochet – Porte-clefs Petit", "Le jardin du crochet")).toBe("Porte-clefs Petit");
    expect(productNameFromItemName("Atelier - Paulette - Bougie", "Atelier - Paulette")).toBe("Bougie");
  });

  it("ancien format « 012 - Nom - Marque » et nom sans marque", () => {
    expect(productNameFromItemName("012 - Pot de fleurs (petit) - Le jardin du crochet", "Le jardin du crochet")).toBe("Pot de fleurs (petit)");
    expect(productNameFromItemName("Carte cadeau", "Baldck")).toBe("Carte cadeau");
  });
});

describe("sumupCsvRow", () => {
  it("TVA non applicable : colonne Tax rate vide", () => {
    const row = sumupCsvRow({ itemName: "A - B", brand: "A", reference: "R", priceCents: 100, stock: 1, visible: true, vatRate: null, itemId: null, variantId: null });
    expect(row[SUMUP_HEADERS.indexOf("Tax rate (%)")]).toBe("");
  });

  it("produit une ligne identique au format de l'exemple SumUp", () => {
    const row = sumupCsvRow({
      itemName: "P'TITE CREVETTE - Maxi Chouchou",
      brand: "P'TITE CREVETTE",
      reference: "PC001",
      priceCents: 900,
      stock: 17,
      visible: true,
      vatRate: 20,
      itemId: "7126258a-ad57-4e2c-942d-f97ff75af774",
      variantId: "f7922f8e-3db3-4f8e-8b7d-09b191029476",
    });
    expect(row).toHaveLength(SUMUP_HEADERS.length);
    expect(row.join(",")).toBe(SUMUP_SAMPLE.split("\n")[1]);
  });
});
