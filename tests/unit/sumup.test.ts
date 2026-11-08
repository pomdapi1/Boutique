import { describe, expect, it } from "vitest";
import { mapPaymentType, normalizeSumUpTransaction, type SumUpTransactionDetail } from "@/lib/sumup/client";

const base: SumUpTransactionDetail = {
  id: "tx-1",
  transaction_code: "TEENSK4W2K",
  amount: 55.2,
  currency: "EUR",
  timestamp: "2026-11-08T14:01:00.000Z",
  status: "SUCCESSFUL",
  payment_type: "POS",
  simple_payment_type: "EMV",
  fee_amount: 0.97,
  products: [
    { name: "007 - moyen bruts - Mr Prout", price: 35, quantity: 1, total_price: 35 },
    { name: "012 - Pot de fleurs (petit) - Le jardin du crochet", price: 20, quantity: 1, total_price: 20, total_with_vat: 20 },
    { name: "003 - Moyen sac - Conserve", price: 0.1, quantity: 2, total_price: 0.2 },
  ],
};

describe("normalizeSumUpTransaction", () => {
  it("convertit montants en centimes et lignes produits", () => {
    const t = normalizeSumUpTransaction(base);
    expect(t.totalCents).toBe(5520);
    expect(t.feeCents).toBe(97);
    expect(t.paymentType).toBe("CARD");
    expect(t.lines).toEqual([
      { name: "007 - moyen bruts - Mr Prout", quantity: 1, totalCents: 3500, unitPriceCents: 3500 },
      { name: "012 - Pot de fleurs (petit) - Le jardin du crochet", quantity: 1, totalCents: 2000, unitPriceCents: 2000 },
      { name: "003 - Moyen sac - Conserve", quantity: 2, totalCents: 20, unitPriceCents: 10 },
    ]);
  });

  it("frais absents → null (estimés plus tard)", () => {
    expect(normalizeSumUpTransaction({ ...base, fee_amount: undefined }).feeCents).toBeNull();
  });

  it("sans lignes produits : utilise product_summary", () => {
    const t = normalizeSumUpTransaction({ ...base, products: [], product_summary: "Vente rapide" });
    expect(t.lines).toEqual([{ name: "Vente rapide", quantity: 1, totalCents: 5520, unitPriceCents: 5520 }]);
  });

  it("remboursement", () => {
    expect(normalizeSumUpTransaction({ ...base, status: "REFUNDED" }).status).toBe("REFUNDED");
  });
});

describe("mapPaymentType", () => {
  it("espèces / carte / autre", () => {
    expect(mapPaymentType({ ...base, simple_payment_type: "CASH" })).toBe("CASH");
    expect(mapPaymentType({ ...base, simple_payment_type: undefined, payment_type: "POS" })).toBe("CARD");
    expect(mapPaymentType({ ...base, simple_payment_type: "BITCOIN" })).toBe("OTHER");
  });
});
