import { prisma } from "./db";
import { breakdown, type Breakdown } from "./money";
import { lastMonths, monthKey, monthRange, shiftMonth, type MonthKey } from "./dates";
import type { Prisma } from "@prisma/client";

export type Scope = { creatorId: string } | { all: true };

function itemWhere(scope: Scope, start: Date, end: Date): Prisma.SaleItemWhereInput {
  return {
    ...("creatorId" in scope ? { creatorId: scope.creatorId } : {}),
    sale: { status: "SUCCESSFUL", occurredAt: { gte: start, lt: end } },
  };
}

export async function loadItems(scope: Scope, start: Date, end: Date) {
  return prisma.saleItem.findMany({
    where: itemWhere(scope, start, end),
    include: {
      sale: { select: { id: true, occurredAt: true, paymentType: true } },
      product: { select: { id: true, code: true, name: true } },
    },
    orderBy: { sale: { occurredAt: "desc" } },
  });
}

export type LoadedItem = Awaited<ReturnType<typeof loadItems>>[number];

/** Plage de comparaison : mois précédent, tronqué "à date" si le mois est en cours. */
export function comparisonRange(key: MonthKey, now = new Date()) {
  const { start, end } = monthRange(key);
  const prev = monthRange(shiftMonth(key, -1));
  const ongoing = now >= start && now < end;
  if (!ongoing) return { ...prev, toDate: false };
  const elapsed = now.getTime() - start.getTime();
  return { start: prev.start, end: new Date(Math.min(prev.start.getTime() + elapsed, prev.end.getTime())), toDate: true };
}

function distinctSales(items: LoadedItem[]) {
  return new Set(items.map((i) => i.sale.id)).size;
}

export type StatsResult = {
  current: Breakdown & { salesCount: number; avgTicketCents: number };
  previous: Breakdown & { salesCount: number; avgTicketCents: number };
  comparisonToDate: boolean;
  monthly: { month: MonthKey; grossCents: number; netCents: number }[];
  averageMonthlyGross: number;
  topQuantity: { label: string; value: number }[];
  topAmount: { label: string; value: number }[];
  payments: { type: string; cents: number }[];
};

function summarize(items: LoadedItem[]) {
  const b = breakdown(items);
  const salesCount = distinctSales(items);
  return { ...b, salesCount, avgTicketCents: salesCount ? Math.round(b.grossCents / salesCount) : 0 };
}

export async function computeStats(scope: Scope, key: MonthKey): Promise<StatsResult> {
  const months = lastMonths(key, 12);
  const { end } = monthRange(key);
  const { start: seriesStart } = monthRange(months[0]!);
  const { start } = monthRange(key);
  const cmp = comparisonRange(key);

  const [series, previousItems] = await Promise.all([
    loadItems(scope, seriesStart, end),
    loadItems(scope, cmp.start, cmp.end),
  ]);
  const currentItems = series.filter((i) => i.sale.occurredAt >= start);

  const byMonth = new Map<string, LoadedItem[]>();
  for (const it of series) {
    const k = monthKey(it.sale.occurredAt);
    byMonth.set(k, [...(byMonth.get(k) ?? []), it]);
  }
  const monthly = months.map((m) => {
    const b = breakdown(byMonth.get(m) ?? []);
    return { month: m, grossCents: b.grossCents, netCents: b.netCents };
  });
  const activeMonths = monthly.filter((m) => m.grossCents > 0);
  const averageMonthlyGross = activeMonths.length
    ? Math.round(activeMonths.reduce((a, m) => a + m.grossCents, 0) / activeMonths.length)
    : 0;

  const perProduct = new Map<string, { label: string; qty: number; cents: number }>();
  for (const it of currentItems) {
    const key = it.productId ?? `label:${it.label}`;
    const label = it.product ? `${it.product.code} - ${it.product.name}` : it.label;
    const cur = perProduct.get(key) ?? { label, qty: 0, cents: 0 };
    cur.qty += it.quantity;
    cur.cents += it.totalCents;
    perProduct.set(key, cur);
  }
  const prods = [...perProduct.values()];
  const topQuantity = [...prods]
    .sort((a, b) => b.qty - a.qty || b.cents - a.cents)
    .slice(0, 10)
    .map((p) => ({ label: p.label, value: p.qty }));
  const topAmount = [...prods]
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 10)
    .map((p) => ({ label: p.label, value: p.cents }));

  const payMap = new Map<string, number>();
  for (const it of currentItems) payMap.set(it.sale.paymentType, (payMap.get(it.sale.paymentType) ?? 0) + it.totalCents);
  const payments = [...payMap.entries()].map(([type, cents]) => ({ type, cents })).sort((a, b) => b.cents - a.cents);

  return {
    current: summarize(currentItems),
    previous: summarize(previousItems),
    comparisonToDate: cmp.toDate,
    monthly,
    averageMonthlyGross,
    topQuantity,
    topAmount,
    payments,
  };
}

/** CA brut par créateur sur un mois (modale "CA global"). */
export async function grossByCreator(key: MonthKey) {
  const { start, end } = monthRange(key);
  const [groups, creators] = await Promise.all([
    prisma.saleItem.groupBy({
      by: ["creatorId"],
      where: { creatorId: { not: null }, sale: { status: "SUCCESSFUL", occurredAt: { gte: start, lt: end } } },
      _sum: { totalCents: true },
    }),
    prisma.creator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const sums = new Map(groups.map((g) => [g.creatorId!, g._sum.totalCents ?? 0]));
  return creators
    .map((c) => ({ id: c.id, name: c.name, grossCents: sums.get(c.id) ?? 0 }))
    .filter((c) => c.grossCents > 0);
}

export async function shopTotal(start: Date, end: Date) {
  const r = await prisma.sale.aggregate({
    where: { status: "SUCCESSFUL", occurredAt: { gte: start, lt: end } },
    _sum: { totalCents: true },
    _count: true,
  });
  return { cents: r._sum.totalCents ?? 0, count: r._count };
}

/** Reversements calculés pour un mois, fusionnés avec les clôtures existantes. */
export async function computePayouts(key: MonthKey) {
  const { start, end } = monthRange(key);
  const [creators, items, closed] = await Promise.all([
    prisma.creator.findMany({ orderBy: { name: "asc" } }),
    prisma.saleItem.findMany({
      where: { creatorId: { not: null }, sale: { status: "SUCCESSFUL", occurredAt: { gte: start, lt: end } } },
      select: { creatorId: true, totalCents: true, feeCents: true, commissionCents: true, quantity: true },
    }),
    prisma.payout.findMany({ where: { month: key } }),
  ]);
  const closedMap = new Map(closed.map((p) => [p.creatorId, p]));
  return creators
    .map((c) => {
      const b = breakdown(items.filter((i) => i.creatorId === c.id));
      return { creator: c, computed: b, payout: closedMap.get(c.id) ?? null };
    })
    .filter((r) => r.computed.grossCents > 0 || r.payout);
}
