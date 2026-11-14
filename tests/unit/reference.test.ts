import { describe, expect, it } from "vitest";
import { normalizeReference } from "@/lib/reference";

describe("normalizeReference", () => {
  it("met en majuscules et nettoie les espaces", () => {
    expect(normalizeReference("  pot-petit-01 ")).toEqual({ value: "POT-PETIT-01" });
    expect(normalizeReference("bag   01")).toEqual({ value: "BAG 01" });
    expect(normalizeReference("ref/2026.a_1")).toEqual({ value: "REF/2026.A_1" });
  });

  it("refuse vide, trop long, accents ou caractères spéciaux", () => {
    expect(normalizeReference("")).toHaveProperty("error");
    expect(normalizeReference("   ")).toHaveProperty("error");
    expect(normalizeReference("A".repeat(41))).toHaveProperty("error");
    expect(normalizeReference("crème-01")).toHaveProperty("error");
    expect(normalizeReference("-01")).toHaveProperty("error");
    expect(normalizeReference("a#1")).toHaveProperty("error");
  });
});
