import Link from "next/link";
import { ArrowRight, BarChart3, CreditCard, Banknote, FileText } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseMonthKey, timeLabel } from "@/lib/dates";
import { breakdown, euros } from "@/lib/money";
import { loadCreatorSales, parseSalesFilters } from "@/lib/creator-sales";
import { groupByDay } from "@/lib/feed";
import { PAYMENT_LABEL } from "@/lib/constants";
import { MonthNav, ParamSelect } from "@/components/filters";
import { EmptyState, StatCard } from "@/components/ui";

type SP = Promise<Record<string, string | undefined>>;

export default async function SalesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const month = parseMonthKey(sp.m);
  const filters = parseSalesFilters(sp, month);

  const [items, products] = await Promise.all([
    loadCreatorSales(creator.id, filters),
    prisma.product.findMany({ where: { creatorId: creator.id }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const b = breakdown(items);
  const groups =
    filters.sort === "amount"
      ? [{ key: "all", label: "Par montant", rows: items }]
      : groupByDay(items, (i) => i.sale.occurredAt);

  const exportQs = new URLSearchParams({ m: month, ...(filters.payment !== "all" ? { pay: filters.payment } : {}), ...(filters.productId ? { product: filters.productId } : {}) });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <MonthNav month={month} />
        <ParamSelect
          name="sort"
          label="Tri"
          value={filters.sort}
          options={[
            { value: "recent", label: "Récent (défilement)" },
            { value: "oldest", label: "Ancien d'abord" },
            { value: "amount", label: "Montant décroissant" },
          ]}
        />
        <ParamSelect
          name="pay"
          label="Mode de paiement"
          value={filters.payment}
          options={[
            { value: "all", label: "Tous" },
            { value: "CARD", label: "Carte" },
            { value: "CASH", label: "Espèces" },
          ]}
        />
        <ParamSelect
          name="product"
          label="Produit"
          className="max-w-72 flex-1"
          value={filters.productId ?? ""}
          options={[{ value: "", label: "Tous les produits" }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <a href={`/api/export/sales?${exportQs}`} className="btn btn-outline h-12 sm:ml-auto">
          <FileText size={18} /> Exporter en PDF
        </a>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="CA brut" value={euros(b.grossCents)} />
        <StatCard label="Frais SumUp" value={euros(b.feeCents)} />
        <StatCard label={`Commission Les Songes Créatifs (${Math.round(creator.commissionRate * 100)} %)`} value={euros(b.commissionCents)} />
        <StatCard label="CA net à reverser" value={euros(b.netCents)} accent />
        <StatCard label="Articles vendus" value={b.quantity} />
      </div>

      <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-sage-50 p-5 sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-sage-200 text-sage-600">
          <BarChart3 size={22} />
        </span>
        <div className="flex-1">
          <div className="font-semibold">Voir vos statistiques détaillées</div>
          <div className="text-sm text-muted">Évolution mensuelle, top produits, modes de paiement…</div>
        </div>
        <Link href={`/creator/stats?m=${month}`} className="btn btn-primary">
          Mes statistiques <ArrowRight size={18} />
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState>Aucune vente pour ces critères.</EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg text-muted">{g.label}</h2>
                <span className="font-semibold">{euros(g.rows.reduce((a, r) => a + r.totalCents, 0))}</span>
              </div>
              <ul className="card divide-y divide-line">
                {g.rows.map((it) => (
                  <li key={it.id} className="flex items-center gap-4 px-6 py-4">
                    <span className="text-card-blue">
                      {it.sale.paymentType === "CASH" ? <Banknote size={22} /> : <CreditCard size={22} />}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold">
                        {it.quantity > 1 && `${it.quantity} × `}
                        {it.product ? it.product.name : it.label}
                      </div>
                      <div className="text-sm text-muted">
                        {filters.sort === "amount" && `${it.sale.occurredAt.toLocaleDateString("fr-FR")} · `}
                        {timeLabel(it.sale.occurredAt)} · {PAYMENT_LABEL[it.sale.paymentType]}
                      </div>
                    </div>
                    <span className="font-semibold">{euros(it.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
