import { prisma } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import { parseMonthKey } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { MonthNav, ParamSelect } from "@/components/filters";
import { StatsView } from "@/components/stats-view";

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminStatsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const month = parseMonthKey(sp.m);
  const creators = await prisma.creator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const creatorId = creators.some((c) => c.id === sp.creator) ? sp.creator! : "";
  const stats = await computeStats(creatorId ? { creatorId } : { all: true }, month);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Statistiques" />
      <div className="mb-6 flex flex-wrap gap-3">
        <MonthNav month={month} />
        <ParamSelect
          name="creator"
          label="Créateur"
          value={creatorId}
          options={[{ value: "", label: "Toute la boutique" }, ...creators.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>
      <StatsView stats={stats} month={month} mode={creatorId ? "mine" : "shop"} />
    </div>
  );
}
