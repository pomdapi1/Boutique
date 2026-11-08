import Link from "next/link";
import { PackageX } from "lucide-react";
import type { StatsResult } from "@/lib/stats";
import { eurosFr, pctChange } from "@/lib/money";
import { monthLabel, monthName, monthShortLabel, shiftMonth } from "@/lib/dates";
import { PAYMENT_LABEL } from "@/lib/constants";
import { Trend } from "./ui";
import { MonthlyRevenueChart, Sparkline } from "./charts";
import { cn } from "@/lib/utils";

function TopList({ title, rows, format }: { title: string; rows: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="card p-6">
      <h3 className="mb-5 text-lg font-semibold">{title}</h3>
      {rows.length === 0 && <p className="text-sm text-muted">Aucune vente ce mois-ci.</p>}
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.label} className="relative flex items-center gap-3 px-4 py-2.5">
            <span
              className={cn("absolute inset-y-0 left-0 rounded-lg", i === 0 ? "bg-coral-100" : "bg-plum-100/70")}
              style={{ width: `${Math.max(8, (r.value / max) * 100)}%` }}
            />
            <span className="relative w-4 text-sm text-muted">{i + 1}</span>
            <span className="relative flex-1 truncate">{r.label}</span>
            <span className="relative font-semibold">{format(r.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PaymentSplit({ payments }: { payments: StatsResult["payments"] }) {
  const total = payments.reduce((a, p) => a + p.cents, 0);
  const colors = ["#3a0b24", "#c7b8c0", "#f25f5c"];
  return (
    <div className="card p-6">
      <h3 className="mb-5 text-lg font-semibold">Ventes par mode de paiement</h3>
      {total === 0 ? (
        <p className="text-sm text-muted">Aucune vente ce mois-ci.</p>
      ) : (
        <>
          <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Répartition par mode de paiement">
            {payments.map((p, i) => (
              <span key={p.type} style={{ width: `${(p.cents / total) * 100}%`, background: colors[i] }} />
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {payments.map((p, i) => (
              <li key={p.type} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} />
                <span className="flex-1">{PAYMENT_LABEL[p.type] ?? p.type}</span>
                <span className="font-semibold">{eurosFr(p.cents)}</span>
                <span className="w-14 text-right text-sm text-muted">{((p.cents / total) * 100).toFixed(1).replace(".", ",")} %</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function StatsView({
  stats,
  month,
  mode,
  outOfStock,
}: {
  stats: StatsResult;
  month: string;
  mode: "mine" | "shop";
  outOfStock?: number;
}) {
  const { current: c, previous: p } = stats;
  const vs = `vs ${monthShortLabel(shiftMonth(month, -1)).split(" ")[0]}`;
  const heroValue = mode === "mine" ? c.netCents : c.grossCents;
  const heroPrev = mode === "mine" ? p.netCents : p.grossCents;
  const spark = stats.monthly.slice(-6).map((m) => (mode === "mine" ? m.netCents : m.grossCents));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-2xl bg-coral-50 p-7 sm:flex-row sm:items-center">
        <div>
          <div className="eyebrow">
            {mode === "mine" ? "Net à reverser" : "CA de la boutique"} · {monthLabel(month)}
          </div>
          <div className="mt-2 text-5xl font-bold text-coral-500 sm:text-6xl">{eurosFr(heroValue)}</div>
          {mode === "mine" ? (
            <p className="mt-2 text-sm text-muted">
              {eurosFr(c.grossCents)} de ventes − {eurosFr(c.feeCents)} de commission SumUp − {eurosFr(c.commissionCents)} de commission Conserve
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {c.salesCount} paniers · {c.quantity} articles vendus
            </p>
          )}
          <div className="mt-2">
            <Trend pct={pctChange(heroValue, heroPrev)} label={`vs ${monthName(shiftMonth(month, -1))}${stats.comparisonToDate ? " (à date)" : ""}`} />
          </div>
        </div>
        <Sparkline values={spark} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "CA du mois", v: eurosFr(c.grossCents), pct: pctChange(c.grossCents, p.grossCents) },
          { label: "Articles vendus", v: c.quantity, pct: pctChange(c.quantity, p.quantity) },
          { label: "Ticket moyen", v: eurosFr(c.avgTicketCents), pct: pctChange(c.avgTicketCents, p.avgTicketCents) },
        ].map((k) => (
          <div key={k.label} className="card p-6">
            <div className="eyebrow">{k.label}</div>
            <div className="mt-2 text-3xl font-bold">{k.v}</div>
            <div className="mt-2">
              <Trend pct={k.pct} label={vs} />
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6 sm:p-8">
        <h3 className="mb-4 text-xl font-semibold">Évolution du CA — 12 derniers mois</h3>
        <MonthlyRevenueChart
          data={stats.monthly}
          average={stats.averageMonthlyGross}
          currentMonth={month}
          averageLabel={mode === "mine" ? "ma moyenne" : "moyenne"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopList title="Top 10 — Plus vendus (quantité)" rows={stats.topQuantity} format={(v) => `${v} u.`} />
        <TopList title="Top 10 — Plus vendus (en euros)" rows={stats.topAmount} format={(v) => eurosFr(v)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentSplit payments={stats.payments} />
        {mode === "mine" && outOfStock !== undefined && (
          <div className="card flex gap-4 self-start p-6">
            <PackageX className="text-coral-500" size={26} />
            <div>
              <div className="text-lg font-semibold">À réassortir</div>
              <p className="mt-1 text-muted">
                {outOfStock === 0
                  ? "Aucun produit en rupture de stock."
                  : `${outOfStock} produit${outOfStock > 1 ? "s sont" : " est"} en rupture de stock.`}
              </p>
              {outOfStock > 0 && (
                <Link href="/creator/products?tab=rupture" className="mt-2 inline-block font-medium underline">
                  Voir mes ruptures →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
