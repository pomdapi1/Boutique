import { describe, expect, it } from "vitest";
import { charCount, normalizeText } from "@/lib/text";

describe("normalizeText / charCount", () => {
  it("unifie les retours à la ligne et retire les espaces de bord", () => {
    expect(normalizeText("  a\r\nb\rc  ")).toBe("a\nb\nc");
    expect(normalizeText(null)).toBe("");
  });

  it("compte un emoji comme un caractère", () => {
    expect(charCount("crochet 🌸")).toBe(9);
    expect(charCount("é")).toBe(1);
  });
});
