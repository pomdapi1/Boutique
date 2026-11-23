import { describe, expect, it } from "vitest";
import { decodeText, parseCsv, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("lit le format SumUp (virgules, champs vides, CRLF)", () => {
    expect(parseCsv("Item name,Price,SKU\r\nP'TITE CREVETTE - Maxi Chouchou,9.00,PC001\r\n")).toEqual([
      ["Item name", "Price", "SKU"],
      ["P'TITE CREVETTE - Maxi Chouchou", "9.00", "PC001"],
    ]);
  });

  it("gère guillemets, virgules et retours à la ligne dans les valeurs", () => {
    const csv = toCsv([["Nom", "Desc"], ['Collier, "perles"', "ligne 1\nligne 2"]]);
    expect(csv).toBe('Nom,Desc\r\n"Collier, ""perles""","ligne 1\nligne 2"\r\n');
    expect(parseCsv(csv)).toEqual([["Nom", "Desc"], ['Collier, "perles"', "ligne 1\nligne 2"]]);
  });

  it("détecte le point-virgule d'un fichier réenregistré par Excel en français", () => {
    expect(parseCsv("Item name;Price\nBague;18,50\n")).toEqual([["Item name", "Price"], ["Bague", "18,50"]]);
  });

  it("décode UTF-8 (avec ou sans BOM) et Windows-1252", () => {
    expect(decodeText(Buffer.from("﻿Barrette NŒUD", "utf8"))).toBe("Barrette NŒUD");
    expect(decodeText(Buffer.from([0x74, 0xe9, 0x6c, 0xe9]))).toBe("télé"); // « télé » en Windows-1252
  });
});
