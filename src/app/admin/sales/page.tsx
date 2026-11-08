import { prisma } from "@/lib/db";
import { loadShopFeed } from "@/lib/feed";
import { monthRange, parseMonthKey } from "@/lib/dates";
import { euros } from "@/lib/money";
import { timeLabel, dateLabel } from "@/lib/dates";
import { EmptyState, PageHeader, TabLinks } from "@/components/ui";
import { AutoRefresh, MonthNav } from "@/components/filters";
import { SaleFeed } from "@/components/sale-feed";
import { assignSaleItemAction } from "@/app/actions/admin";

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminSalesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filter = sp.filter === "unassigned" ? "unassigned" : "all";
  const month = parseMonthKey(sp.m);
  const { start, end } = monthRange(month);
  const unassignedCount = await prisma.saleItem.count({ where: { creatorId: null, sale: { status: "SUCCESSFUL" } } });

  return (
    <div className="mx-auto max-w-6xl">
      <AutoRefresh seconds={30} />
      <PageHeader title="Ventes" subtitle="Toutes les transactions importées depuis SumUp." />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <TabLinks
          active={filter}
          tabs={[
            { key: "all", label: "Toutes les ventes", href: `?m=${month}` },
            { key: "unassigned", label: "Non attribuées", href: "?filter=unassigned", badge: unassignedCount },
          ]}
        />
        {filter === "all" && <MonthNav month={month} />}
      </div>
      {filter === "unassigned" ? <Unassigned /> : <AllSales start={start} end={end} />}
    </div>
  );
}

async function AllSales({ start, end }: { start: Date; end: Date }) {
  const sales = await loadShopFeed({ since: start, until: end, limit: 1000 });
  return sales.length === 0 ? <EmptyState>Aucune vente ce mois-ci.</EmptyState> : <SaleFeed sales={sales} />;
}

async function Unassigned() {
  const [items, products] = await Promise.all([
    prisma.saleItem.findMany({
      where: { creatorId: null, sale: { status: "SUCCESSFUL" } },
      include: { sale: true },
      orderBy: { sale: { occurredAt: "desc" } },
      take: 200,
    }),
    prisma.product.findMany({
      where: { status: { in: ["ACTIVE", "PENDING", "ARCHIVED"] } },
      include: { creator: { select: { name: true } } },
      orderBy: [{ creator: { name: "asc" } }, { code: "asc" }],
    }),
  ]);
  if (items.length === 0) return <EmptyState>Toutes les lignes de vente sont attribuées à un créateur.</EmptyState>;
  return (
    <>
      <p className="mb-4 text-muted">
        Ces lignes n&apos;ont pas pu être rattachées à un produit (nom SumUp non reconnu). Attribuez-les manuellement ; pour éviter que cela se
        reproduise, renseignez le « nom dans la caisse SumUp » du produit concerné.
      </p>
      <ul className="card divide-y divide-line">
        {items.map((it) => (
          <li key={it.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <div className="font-medium">
                {it.quantity > 1 && `${it.quantity} × `}
                {it.label}
              </div>
              <div className="text-sm text-muted">
                {dateLabel(it.sale.occurredAt)} {timeLabel(it.sale.occurredAt)} · {euros(it.totalCents)}
              </div>
            </div>
            <form action={assignSaleItemAction} className="flex gap-2">
              <input type="hidden" name="itemId" value={it.id} />
              <select name="productId" required className="input w-80 bg-white py-2" defaultValue="">
                <option value="" disabled>
                  Choisir le produit…
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.creator.name} — {p.code} - {p.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm">Attribuer</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
