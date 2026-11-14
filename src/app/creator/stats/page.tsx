import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import { parseMonthKey } from "@/lib/dates";
import { PageHeader, TabLinks } from "@/components/ui";
import { MonthNav } from "@/components/filters";
import { StatsView } from "@/components/stats-view";

type SP = Promise<Record<string, string | undefined>>;

export default async function StatsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const month = parseMonthKey(sp.m);
  const tab = sp.tab === "shop" ? "shop" : "mine";

  const [stats, outOfStock] = await Promise.all([
    computeStats(tab === "mine" ? { creatorId: creator.id } : { all: true }, month, { withCodes: false }),
    prisma.product.count({ where: { creatorId: creator.id, status: "ACTIVE", stock: { lte: 0 } } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Statistiques" />
      <div className="mb-6 flex flex-col gap-6">
        <MonthNav month={month} />
        <TabLinks
          active={tab}
          tabs={[
            { key: "mine", label: "Mes ventes", href: `?m=${month}&tab=mine` },
            { key: "shop", label: "Boutique", href: `?m=${month}&tab=shop` },
          ]}
        />
      </div>
      <StatsView stats={stats} month={month} mode={tab} outOfStock={outOfStock} />
    </div>
  );
}
