import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_IP,
  clientIp,
  loginBlockedFor,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginLimits,
} from "@/lib/rate-limit";
import { looksLikeFormula } from "@/lib/text";
import { readProductRows, SUMUP_HEADERS } from "@/lib/product-sheet";

describe("limitation des tentatives de connexion", () => {
  beforeEach(() => resetLoginLimits());

  it("bloque un compte après trop d'échecs, pendant 15 minutes", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT - 1; i++) recordLoginFailure("A@x.fr", "1.1.1.1", t0);
    expect(loginBlockedFor("a@x.fr", "1.1.1.1", t0)).toBe(0);
    recordLoginFailure("a@x.fr ", "2.2.2.2", t0); // casse, espaces et IP différente : même compte
    expect(loginBlockedFor("a@x.fr", "3.3.3.3", t0)).toBe(15 * 60);
    expect(loginBlockedFor("b@x.fr", "3.3.3.3", t0)).toBe(0);
    expect(loginBlockedFor("a@x.fr", null, t0 + 15 * 60 * 1000)).toBe(0);
  });

  it("bloque une IP qui essaie de nombreux comptes", () => {
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) recordLoginFailure(`u${i}@x.fr`, "9.9.9.9");
    expect(loginBlockedFor("nouveau@x.fr", "9.9.9.9")).toBeGreaterThan(0);
    expect(loginBlockedFor("nouveau@x.fr", "8.8.8.8")).toBe(0);
  });

  it("une connexion réussie remet le compteur du compte à zéro", () => {
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT; i++) recordLoginFailure("c@x.fr", null);
    expect(loginBlockedFor("c@x.fr", null)).toBeGreaterThan(0);
    recordLoginSuccess("C@x.fr");
    expect(loginBlockedFor("c@x.fr", null)).toBe(0);
  });

  it("prend l'IP ajoutée par le proxy (dernière de X-Forwarded-For)", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 5.5.5.5" }))).toBe("5.5.5.5");
    expect(clientIp(new Headers({ "x-real-ip": "4.4.4.4" }))).toBe("4.4.4.4");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("injection de formule (exports CSV ouverts dans Excel)", () => {
  it("détecte les débuts de formule", () => {
    for (const s of ["=1+1", "+33", "-2", "@SUM(A1)", " =HYPERLINK()", "\t=1"]) expect(looksLikeFormula(s)).toBe(true);
    for (const s of ["Bague 3=4", "Collier", "Koloro - Print A5", "100 % coton", ""]) expect(looksLikeFormula(s)).toBe(false);
  });

  it("refuse un Item name commençant par une formule à l'import", () => {
    const line = SUMUP_HEADERS.map((h) =>
      h === "Item name" ? "=HYPERLINK(\"http://x\")" : h === "Price" ? "5.00" : h === "SKU" ? "Z-1" : "",
    );
    const { rows, errors } = readProductRows([[...SUMUP_HEADERS], line]);
    expect(rows).toHaveLength(0);
    expect(errors[0]!.message).toMatch(/ne doit pas commencer par =/);
  });
});
