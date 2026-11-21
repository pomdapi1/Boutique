import { describe, expect, it } from "vitest";
import { cellValue, readProductRows, SHEET_COLUMNS as C } from "@/lib/product-sheet";

const header = [C.code, C.reference, C.name, C.price, C.quantity, C.status];

describe("readProductRows", () => {
  it("lit les lignes valides (prix numérique ou texte, quantité vide autorisée)", () => {
    const { rows, errors } = readProductRows([
      header,
      ["1", "cro-001", "Porte-clefs", 12, 8, "Actif"],
      [null, "NEW-1", "Nouveau produit", "14,50", null, null],
    ]);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, code: "001", reference: "CRO-001", name: "Porte-clefs", priceCents: 1200, quantity: 8 },
      { line: 3, code: null, reference: "NEW-1", name: "Nouveau produit", priceCents: 1450, quantity: null },
    ]);
  });

  it("ignore les lignes vides et accepte les en-têtes sans accents ni parenthèses", () => {
    const { rows, errors } = readProductRows([
      ["reference", "nom", "prix", "quantite"],
      [null, null, null, null],
      ["A-1", "Bague", 18.5, 2],
    ]);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.line)).toEqual([3]);
  });

  it("signale les erreurs ligne par ligne", () => {
    const { rows, errors } = readProductRows([
      header,
      [null, "", "Sans référence", 10, 1],
      [null, "B-1", "X", -3, 1.5],
    ]);
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
    expect(errors[1]!.message).toMatch(/Nom manquant.*Prix manquant.*Quantité invalide/);
  });

  it("détecte les références et identifiants en double", () => {
    const { errors } = readProductRows([header, ["1", "A", "Un", 1, 1], ["1", "a", "Deux", 2, 1]]);
    expect(errors.map((e) => e.message)).toEqual([
      "Identifiant 001 en double (déjà ligne 2).",
      "Référence A en double (déjà ligne 2).",
    ]);
  });

  it("refuse un fichier sans les colonnes obligatoires", () => {
    const { errors } = readProductRows([["Nom", "Prix"]]);
    expect(errors[0]!.message).toMatch(/Colonnes manquantes : Référence/);
  });
});

describe("readProductRows (mode admin)", () => {
  const adminHeader = [C.brand, C.code, C.reference, C.name, C.price, C.quantity, C.status, C.sumupName];

  it("lit marque, statut (libellé français) et nom SumUp", () => {
    const { rows, errors } = readProductRows(
      [adminHeader, ["Baldck", "1", "bag-01", "Bague", 18, 3, "Archivé", ""], ["Koloro", null, "K-1", "Print", 12, null, null, "001 - Print - Koloro"]],
      { admin: true },
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ brand: "Baldck", code: "001", reference: "BAG-01", status: "ARCHIVED", sumupName: null });
    expect(rows[1]).toMatchObject({ brand: "Koloro", code: null, status: undefined, sumupName: "001 - Print - Koloro" });
  });

  it("exige la marque et refuse un statut inconnu", () => {
    const { errors } = readProductRows([adminHeader, [null, null, "A", "Nom", 5, 1, "Validé", null]], { admin: true });
    expect(errors[0]!.message).toMatch(/Marque manquante.*Statut « Validé » inconnu/);
  });

  it("autorise la même référence pour deux marques différentes, pas pour la même", () => {
    const ok = readProductRows([adminHeader, ["A", null, "R-1", "Un", 1, 1], ["B", null, "R-1", "Deux", 1, 1]], { admin: true });
    expect(ok.errors).toEqual([]);
    const ko = readProductRows([adminHeader, ["A", null, "R-1", "Un", 1, 1], ["a", null, "r-1", "Deux", 1, 1]], { admin: true });
    expect(ko.errors[0]!.message).toBe("Référence R-1 en double pour a (déjà ligne 2).");
  });

  it("exige la colonne Marque", () => {
    const { errors } = readProductRows([header], { admin: true });
    expect(errors[0]!.message).toMatch(/Colonnes manquantes : Marque/);
  });
});

describe("cellValue", () => {
  it("convertit les formats exceljs", () => {
    expect(cellValue({ richText: [{ text: "Po" }, { text: "t" }] })).toBe("Pot");
    expect(cellValue({ formula: "A1*2", result: 24 })).toBe(24);
    expect(cellValue("  ")).toBeNull();
  });
});
