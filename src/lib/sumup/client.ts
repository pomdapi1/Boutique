/**
 * Client minimal pour l'API REST SumUp (https://developer.sumup.com/api).
 * Authentification : clé API secrète (sk_...) en Bearer.
 */
import { majorToCents } from "../money";
import type { NormalizedTransaction } from "../sales";

const BASE_URL = "https://api.sumup.com";

export type SumUpHistoryItem = {
  id: string;
  transaction_code: string;
  amount: number;
  currency: string;
  timestamp: string;
  status: string;
  payment_type?: string;
};

type HistoryResponse = {
  items: SumUpHistoryItem[];
  links?: { rel: string; href: string }[];
};

export type SumUpTransactionDetail = SumUpHistoryItem & {
  fee_amount?: number;
  simple_payment_type?: string;
  product_summary?: string;
  products?: {
    name?: string;
    price?: number;
    price_with_vat?: number;
    quantity?: number;
    total_price?: number;
    total_with_vat?: number;
  }[];
};

export class SumUpClient {
  constructor(
    private apiKey: string,
    private merchantCode: string,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SumUp ${res.status} sur ${path.split("?")[0]} : ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  /** Vérifie la clé et renvoie le profil marchand. */
  me() {
    return this.get<{ merchant_profile?: { merchant_code?: string; company_name?: string } }>("/v0.1/me");
  }

  /** Toutes les transactions modifiées depuis `since` (pagination suivie). */
  async listChangedSince(since: Date): Promise<SumUpHistoryItem[]> {
    const base = `/v2.1/merchants/${encodeURIComponent(this.merchantCode)}/transactions/history`;
    let query = `?limit=100&order=ascending&changes_since=${encodeURIComponent(since.toISOString())}`;
    const all: SumUpHistoryItem[] = [];
    for (let page = 0; page < 50; page++) {
      const data = await this.get<HistoryResponse>(base + query);
      all.push(...(data.items ?? []));
      const next = data.links?.find((l) => l.rel === "next")?.href;
      if (!next || (data.items ?? []).length === 0) break;
      query = next.startsWith("?") ? next : `?${next}`;
    }
    return all;
  }

  getTransaction(id: string) {
    return this.get<SumUpTransactionDetail>(
      `/v2.1/merchants/${encodeURIComponent(this.merchantCode)}/transactions?id=${encodeURIComponent(id)}`,
    );
  }
}

export function mapPaymentType(t: SumUpTransactionDetail): "CARD" | "CASH" | "OTHER" {
  const p = (t.simple_payment_type ?? t.payment_type ?? "").toUpperCase();
  if (p === "CASH") return "CASH";
  if (["POS", "ECOM", "CARD", "EMV", "CC_SIGNATURE", "CC_CUSTOMER_ENTERED", "MANUAL_ENTRY", "MOTO"].includes(p))
    return "CARD";
  return "OTHER";
}

export function normalizeSumUpTransaction(t: SumUpTransactionDetail): NormalizedTransaction {
  const lines = (t.products ?? [])
    .filter((p) => p.name)
    .map((p) => {
      const quantity = Math.max(1, Math.round(p.quantity ?? 1));
      const total = majorToCents(p.total_with_vat ?? p.total_price ?? (p.price_with_vat ?? p.price ?? 0) * quantity);
      return {
        name: p.name!,
        quantity,
        totalCents: total,
        unitPriceCents: Math.round(total / quantity),
      };
    });

  if (lines.length === 0 && t.product_summary) {
    const total = majorToCents(t.amount);
    lines.push({ name: t.product_summary, quantity: 1, totalCents: total, unitPriceCents: total });
  }

  return {
    externalId: t.id,
    transactionCode: t.transaction_code,
    occurredAt: new Date(t.timestamp),
    totalCents: majorToCents(t.amount),
    feeCents: t.fee_amount != null ? majorToCents(t.fee_amount) : null,
    paymentType: mapPaymentType(t),
    status: t.status === "REFUNDED" ? "REFUNDED" : "SUCCESSFUL",
    lines,
  };
}
