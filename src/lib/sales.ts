import { prisma } from "./db";
import { allocateProportionally, commissionFor } from "./money";
import { buildMatcher, type MatchableProduct } from "./attribution";
import { getCardFeeRate } from "./settings";
import { notifyCreator } from "./notifications";
import { productLabel } from "./utils";

/** Transaction normalisée, indépendante de la source (SumUp, simulation, seed). */
export type NormalizedLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type NormalizedTransaction = {
  externalId: string;
  transactionCode?: string | null;
  occurredAt: Date;
  totalCents: number;
  /** Frais SumUp réels ; null → estimés avec le taux carte configuré. */
  feeCents: number | null;
  paymentType: "CARD" | "CASH" | "OTHER";
  status: "SUCCESSFUL" | "REFUNDED";
  lines: NormalizedLine[];
};

export type IngestOptions = {
  source: "SUMUP" | "SIMULATION";
  /** false pour l'import d'historique sans toucher aux stocks (seed). */
  affectStock?: boolean;
  /** Pour les imports en masse : évite de recharger produits et taux à chaque vente. */
  context?: IngestContext;
};

export type IngestContext = {
  match: ReturnType<typeof buildMatcher>;
  commissionRates: Map<string, number>;
  cardFeeRate: number;
};

export async function loadIngestContext(): Promise<IngestContext> {
  const [products, creators, cardFeeRate] = await Promise.all([
    prisma.product.findMany({
      where: { status: { in: ["ACTIVE", "PENDING", "ARCHIVED"] } },
      include: { creator: { select: { name: true } } },
    }),
    prisma.creator.findMany({ select: { id: true, commissionRate: true } }),
    getCardFeeRate(),
  ]);
  const matchable: MatchableProduct[] = products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    sumupName: p.sumupName,
    creatorId: p.creatorId,
    creatorName: p.creator.name,
  }));
  return {
    match: buildMatcher(matchable),
    commissionRates: new Map(creators.map((c) => [c.id, c.commissionRate])),
    cardFeeRate,
  };
}

export type IngestResult = "created" | "exists" | "refunded" | "skipped";

export async function ingestTransaction(tx: NormalizedTransaction, opts: IngestOptions): Promise<IngestResult> {
  const existing = await prisma.sale.findUnique({ where: { externalId: tx.externalId } });
  if (existing) {
    if (tx.status === "REFUNDED" && existing.status !== "REFUNDED") {
      await markSaleRefunded(existing.id, opts.affectStock !== false);
      return "refunded";
    }
    return "exists";
  }
  if (tx.status !== "SUCCESSFUL") return "skipped";

  const ctx = opts.context ?? (await loadIngestContext());
  const lines: NormalizedLine[] =
    tx.lines.length > 0
      ? tx.lines
      : [{ name: "Vente libre", quantity: 1, unitPriceCents: tx.totalCents, totalCents: tx.totalCents }];

  const feeTotal =
    tx.feeCents ?? (tx.paymentType === "CARD" ? Math.round(tx.totalCents * ctx.cardFeeRate) : 0);
  const feeShares = allocateProportionally(
    feeTotal,
    lines.map((l) => l.totalCents),
  );

  const affectStock = opts.affectStock !== false;

  await prisma.$transaction(async (db) => {
    const sale = await db.sale.create({
      data: {
        externalId: tx.externalId,
        transactionCode: tx.transactionCode ?? null,
        occurredAt: tx.occurredAt,
        totalCents: tx.totalCents,
        feeCents: feeTotal,
        paymentType: tx.paymentType,
        status: "SUCCESSFUL",
        source: opts.source,
      },
    });

    for (const [i, line] of lines.entries()) {
      const { product, creatorId } = ctx.match(line.name);
      const rate = creatorId ? (ctx.commissionRates.get(creatorId) ?? 0) : 0;
      const item = await db.saleItem.create({
        data: {
          saleId: sale.id,
          productId: product?.id ?? null,
          creatorId,
          label: line.name,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.totalCents,
          feeCents: feeShares[i],
          commissionRate: rate,
          commissionCents: commissionFor(line.totalCents, rate),
        },
      });

      if (product && affectStock) {
        const before = await db.product.findUniqueOrThrow({ where: { id: product.id } });
        const after = await db.product.update({
          where: { id: product.id },
          data: { stock: { decrement: line.quantity } },
        });
        await db.stockMovement.create({
          data: { productId: product.id, delta: -line.quantity, reason: "SALE", saleItemId: item.id },
        });
        if (before.stock > 0 && after.stock <= 0) {
          await notifyCreator(
            product.creatorId,
            {
              kind: "STOCK_OUT",
              title: "1 nouveau produit en rupture de stock",
              body: `${productLabel(product)} - ${product.creatorName}`,
              link: "/creator/products?tab=rupture",
            },
            db,
          );
        }
      }
    }
  });

  return "created";
}

export async function markSaleRefunded(saleId: string, restoreStock = true) {
  await prisma.$transaction(async (db) => {
    const sale = await db.sale.update({
      where: { id: saleId },
      data: { status: "REFUNDED" },
      include: { items: true },
    });
    if (!restoreStock) return;
    for (const item of sale.items) {
      if (!item.productId) continue;
      await db.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      await db.stockMovement.create({
        data: { productId: item.productId, delta: item.quantity, reason: "REFUND", saleItemId: item.id },
      });
    }
  });
}

/** Rattache après coup une ligne non reconnue à un produit (admin). */
export async function assignSaleItem(saleItemId: string, productId: string, userId: string) {
  await prisma.$transaction(async (db) => {
    const item = await db.saleItem.findUniqueOrThrow({ where: { id: saleItemId }, include: { sale: true } });
    const product = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { creator: true } });
    const rate = product.creator.commissionRate;
    await db.saleItem.update({
      where: { id: saleItemId },
      data: {
        productId,
        creatorId: product.creatorId,
        commissionRate: rate,
        commissionCents: commissionFor(item.totalCents, rate),
      },
    });
    if (!item.productId && item.sale.status === "SUCCESSFUL") {
      await db.product.update({ where: { id: productId }, data: { stock: { decrement: item.quantity } } });
      await db.stockMovement.create({
        data: { productId, delta: -item.quantity, reason: "SALE", saleItemId, userId, note: "Attribution manuelle" },
      });
    }
  });
}
