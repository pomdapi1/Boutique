import { requireCreator } from "@/lib/auth";
import { loadShopFeed } from "@/lib/feed";
import { shopTotal } from "@/lib/stats";
import { monthKey, monthRange, startOfDay } from "@/lib/dates";
import { euros } from "@/lib/money";
import { PageHeader, EmptyState } from "@/components/ui";
import { SaleFeed } from "@/components/sale-feed";
import { GlobalRevenueButton } from "@/components/global-revenue";
import { AutoRefresh } from "@/components/filters";

export default async function BoutiquePage() {
  const { creator } = await requireCreator();
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 86400_000);
  const month = monthRange(monthKey(today));
  const [day, mon, sales] = await Promise.all([
    shopTotal(today, tomorrow),
    shopTotal(month.start, month.end),
    loadShopFeed({ since: new Date(today.getTime() - 6 * 86400_000), limit: 150 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <AutoRefresh seconds={30} />
      <PageHeader
        title="La boutique"
        subtitle={
          <>
            <p>Le feed des ventes de la boutique en temps réel.</p>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-coral-600" />
              signale les paniers qui contiennent un de vos produits.
            </p>
          </>
        }
        actions={<GlobalRevenueButton meId={creator.id} />}
      />
      <div className="mb-10 flex flex-wrap gap-12">
        <div>
          <div className="eyebrow">Total du jour</div>
          <div className="mt-1 text-4xl font-bold text-plum-900 sm:text-5xl">{euros(day.cents)}</div>
        </div>
        <div>
          <div className="eyebrow">Total du mois actuel</div>
          <div className="mt-1 text-4xl font-bold text-plum-900 sm:text-5xl">{euros(mon.cents)}</div>
        </div>
      </div>
      {sales.length === 0 ? (
        <EmptyState>Aucune vente sur les 7 derniers jours.</EmptyState>
      ) : (
        <SaleFeed sales={sales} highlightCreatorId={creator.id} />
      )}
    </div>
  );
}
