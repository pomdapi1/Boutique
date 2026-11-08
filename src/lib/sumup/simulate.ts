import { prisma } from "../db";
import { canonicalSumupName } from "../attribution";
import { ingestTransaction, loadIngestContext, type NormalizedTransaction } from "../sales";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Fabrique une transaction aléatoire au format SumUp normalisé, à partir des produits actifs en stock. */
export async function buildRandomTransaction(at = new Date()): Promise<NormalizedTransaction | null> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", stock: { gt: 0 } },
    include: { creator: { select: { name: true } } },
  });
  if (products.length === 0) return null;

  const lineCount = 1 + Math.floor(Math.random() * 3);
  const chosen = new Map<string, (typeof products)[number]>();
  for (let i = 0; i < lineCount; i++) {
    const p = pick(products);
    chosen.set(p.id, p);
  }

  const lines = [...chosen.values()].map((p) => {
    const quantity = Math.min(p.stock, Math.random() < 0.85 ? 1 : 2);
    return {
      name: p.sumupName ?? canonicalSumupName({ code: p.code, name: p.name, creatorName: p.creator.name }),
      quantity,
      unitPriceCents: p.priceCents,
      totalCents: p.priceCents * quantity,
    };
  });
  const total = lines.reduce((a, l) => a + l.totalCents, 0);
  const id = `SIM-${at.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    externalId: id,
    transactionCode: id,
    occurredAt: at,
    totalCents: total,
    feeCents: null,
    paymentType: Math.random() < 0.88 ? "CARD" : "CASH",
    status: "SUCCESSFUL",
    lines,
  };
}

export async function simulateSales(count: number) {
  const ctx = await loadIngestContext();
  let created = 0;
  for (let i = 0; i < count; i++) {
    const tx = await buildRandomTransaction(new Date());
    if (!tx) break;
    if ((await ingestTransaction(tx, { source: "SIMULATION", context: ctx })) === "created") created++;
  }
  return created;
}
