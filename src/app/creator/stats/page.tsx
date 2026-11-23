import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import { parseMonthKey } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { MonthNav } from "@/components/filters";
import { StatsView } from "@/components/stats-view";

type SP = Promise<Record<string, string | undefined>>;

/** Statistiques du créateur : uniquement ses propres ventes (pas de chiffres de la boutique). */
export default async function StatsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const month = parseMonthKey(sp.m);

  const [stats, outOfStock] = await Promise.all([
    computeStats({ creatorId: creator.id }, month, { withCodes: false }),
    prisma.product.count({ where: { creatorId: creator.id, status: "ACTIVE", stock: { lte: 0 } } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Statistiques" />
      <div className="mb-6">
        <MonthNav month={month} />
      </div>
      <StatsView stats={stats} month={month} mode="mine" outOfStock={outOfStock} />
    </div>
  );
}
