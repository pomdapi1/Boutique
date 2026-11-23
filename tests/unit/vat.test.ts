import { describe, expect, it } from "vitest";
import { parseVatRate, vatLabel } from "@/lib/constants";

describe("parseVatRate", () => {
  it("accepte vide (non applicable) et 0, 5, 10, 15, 20 sous toutes les écritures", () => {
    expect(parseVatRate("")).toEqual({ value: null });
    expect(parseVatRate("20.00")).toEqual({ value: 20 });
    expect(parseVatRate("5,00")).toEqual({ value: 5 });
    expect(parseVatRate("10 %")).toEqual({ value: 10 });
    expect(parseVatRate("0")).toEqual({ value: 0 });
    expect(parseVatRate(15)).toEqual({ value: 15 });
  });

  it("refuse les autres taux", () => {
    expect(parseVatRate("5.5")).toHaveProperty("error");
    expect(parseVatRate("19.6")).toHaveProperty("error");
    expect(parseVatRate("abc")).toHaveProperty("error");
  });

  it("libellé", () => {
    expect(vatLabel(20)).toBe("TVA 20 %");
    expect(vatLabel(null)).toBe("TVA non applicable");
  });
});
