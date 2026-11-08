import { prisma } from "./db";
import { dayKey, dayLabel } from "./dates";

export async function loadShopFeed(opts: { since: Date; until?: Date; limit?: number; status?: string }) {
  const sales = await prisma.sale.findMany({
    where: {
      occurredAt: { gte: opts.since, ...(opts.until ? { lt: opts.until } : {}) },
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: opts.limit ?? 200,
    include: {
      items: {
        include: {
          product: { select: { code: true, name: true } },
          creator: { select: { name: true } },
        },
      },
    },
  });
  return sales;
}

export type FeedSale = Awaited<ReturnType<typeof loadShopFeed>>[number];

export function itemDisplay(it: FeedSale["items"][number]): { title: string; creator: string | null } {
  if (it.product && it.creator) return { title: `${it.product.code} - ${it.product.name}`, creator: it.creator.name };
  return { title: it.label, creator: it.creator?.name ?? null };
}

export function groupByDay<T>(rows: T[], getDate: (r: T) => Date) {
  const groups: { key: string; label: string; rows: T[] }[] = [];
  for (const r of rows) {
    const d = getDate(r);
    const key = dayKey(d);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: dayLabel(d), rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  return groups;
}
