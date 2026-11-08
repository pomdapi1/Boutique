import { prisma } from "./db";
import { monthRange, type MonthKey } from "./dates";
import type { Prisma } from "@prisma/client";

export type SalesFilters = {
  month: MonthKey;
  sort: "recent" | "oldest" | "amount";
  payment: "all" | "CARD" | "CASH";
  productId: string | null;
};

export function parseSalesFilters(sp: Record<string, string | undefined>, month: MonthKey): SalesFilters {
  return {
    month,
    sort: sp.sort === "oldest" || sp.sort === "amount" ? sp.sort : "recent",
    payment: sp.pay === "CARD" || sp.pay === "CASH" ? sp.pay : "all",
    productId: sp.product || null,
  };
}

export async function loadCreatorSales(creatorId: string, f: SalesFilters) {
  const { start, end } = monthRange(f.month);
  const where: Prisma.SaleItemWhereInput = {
    creatorId,
    ...(f.productId ? { productId: f.productId } : {}),
    sale: {
      status: "SUCCESSFUL",
      occurredAt: { gte: start, lt: end },
      ...(f.payment !== "all" ? { paymentType: f.payment } : {}),
    },
  };
  const orderBy: Prisma.SaleItemOrderByWithRelationInput[] =
    f.sort === "amount"
      ? [{ totalCents: "desc" }]
      : [{ sale: { occurredAt: f.sort === "oldest" ? "asc" : "desc" } }];

  return prisma.saleItem.findMany({
    where,
    orderBy,
    include: {
      sale: { select: { occurredAt: true, paymentType: true } },
      product: { select: { code: true, name: true } },
    },
  });
}
