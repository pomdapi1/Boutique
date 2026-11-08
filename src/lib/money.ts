/** Formatage "12.00 €" (style des maquettes : point décimal, deux décimales). */
export function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

/** Formatage français "1 183,00 €" pour les statistiques. */
export function eurosFr(cents: number, decimals = 2): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
      .format(cents / 100)
      .replace(/ | /g, " ") + " €"
  );
}

/** "12,5" / "12.50" / "12" → 1250. Retourne null si invalide. */
export function parseEurosToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

/** Montant SumUp en unités majeures (10.1) → centimes (1010). */
export function majorToCents(amount: number | null | undefined): number {
  if (amount == null || Number.isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

/**
 * Répartit un montant total (centimes) proportionnellement à des poids,
 * en garantissant que la somme des parts est exactement égale au total
 * (méthode du plus grand reste).
 */
export function allocateProportionally(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const parts = weights.map(() => 0);
    parts[0] = total;
    return parts;
  }
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    parts[order[k].i] += 1;
  }
  return parts;
}

export function commissionFor(totalCents: number, rate: number): number {
  return Math.round(totalCents * rate);
}

export type Breakdown = {
  grossCents: number;
  feeCents: number;
  commissionCents: number;
  netCents: number;
  quantity: number;
};

/** Agrège des lignes de vente en CA brut / frais SumUp / commission / net à reverser. */
export function breakdown(
  items: { totalCents: number; feeCents: number; commissionCents: number; quantity: number }[],
): Breakdown {
  const b = items.reduce(
    (acc, it) => {
      acc.grossCents += it.totalCents;
      acc.feeCents += it.feeCents;
      acc.commissionCents += it.commissionCents;
      acc.quantity += it.quantity;
      return acc;
    },
    { grossCents: 0, feeCents: 0, commissionCents: 0, netCents: 0, quantity: 0 },
  );
  b.netCents = b.grossCents - b.feeCents - b.commissionCents;
  return b;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
