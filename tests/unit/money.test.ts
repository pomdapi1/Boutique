import { describe, expect, it } from "vitest";
import { allocateProportionally, breakdown, commissionFor, euros, parseEurosToCents, pctChange } from "@/lib/money";

describe("allocateProportionally", () => {
  it("la somme des parts est exactement le total", () => {
    for (const [total, weights] of [
      [145, [2000, 2000, 1500, 2500, 2000, 2000]],
      [1, [1, 1, 1]],
      [100, [3333, 3333, 3334]],
      [7, [1]],
    ] as [number, number[]][]) {
      const parts = allocateProportionally(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts).toHaveLength(weights.length);
    }
  });

  it("répartit proportionnellement", () => {
    expect(allocateProportionally(100, [1, 3])).toEqual([25, 75]);
  });

  it("poids nuls : tout sur la première ligne", () => {
    expect(allocateProportionally(50, [0, 0])).toEqual([50, 0]);
  });
});

describe("commission et net à reverser", () => {
  it("30 % du CA brut", () => {
    expect(commissionFor(2000, 0.3)).toBe(600);
    expect(commissionFor(1250, 0.3)).toBe(375);
  });

  it("net = brut − frais SumUp − commission", () => {
    const b = breakdown([
      { totalCents: 2000, feeCents: 35, commissionCents: 600, quantity: 1 },
      { totalCents: 4000, feeCents: 70, commissionCents: 1200, quantity: 2 },
    ]);
    expect(b).toEqual({ grossCents: 6000, feeCents: 105, commissionCents: 1800, netCents: 4095, quantity: 3 });
  });
});

describe("formatage et saisie", () => {
  it("euros()", () => {
    expect(euros(26620)).toBe("266.20 €");
    expect(euros(5)).toBe("0.05 €");
  });

  it("parseEurosToCents()", () => {
    expect(parseEurosToCents("12")).toBe(1200);
    expect(parseEurosToCents("12,5")).toBe(1250);
    expect(parseEurosToCents("12.99 €")).toBe(1299);
    expect(parseEurosToCents("abc")).toBeNull();
    expect(parseEurosToCents("1.234")).toBeNull();
  });

  it("pctChange()", () => {
    expect(pctChange(112, 207)).toBe(-46);
    expect(pctChange(10, 0)).toBeNull();
  });
});
