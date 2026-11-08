import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { shopTotal, computePayouts } from "@/lib/stats";
import { monthKey, monthRange, relativeLabel, startOfDay } from "@/lib/dates";
import { euros } from "@/lib/money";
import { SETTING_KEYS, getSetting, sumupConfig } from "@/lib/settings";
import { loadShopFeed } from "@/lib/feed";
import { PageHeader, StatCard } from "@/components/ui";
import { SaleFeed } from "@/components/sale-feed";
import { GlobalRevenueButton } from "@/components/global-revenue";
import { AutoRefresh } from "@/components/filters";

export default async function AdminDashboard() {
  const today = startOfDay();
  const m = monthKey(today);
  const { start, end } = monthRange(m);
  const [day, month, payouts, pendingProducts, pendingRequests, unassigned, outOfStock, lastRun, lastError, feed] = await Promise.all([
    shopTotal(today, new Date(today.getTime() + 86400_000)),
    shopTotal(start, end),
    computePayouts(m),
    prisma.product.count({ where: { status: "PENDING" } }),
    prisma.productRequest.count({ where: { status: "PENDING" } }),
    prisma.saleItem.count({ where: { creatorId: null, sale: { status: "SUCCESSFUL" } } }),
    prisma.product.count({ where: { status: "ACTIVE", stock: { lte: 0 } } }),
    getSetting(SETTING_KEYS.sumupLastRunAt),
    getSetting(SETTING_KEYS.sumupLastError),
    loadShopFeed({ since: today, limit: 15 }),
  ]);
  const commission = payouts.reduce((a, p) => a + p.computed.commissionCents, 0);
  const toPay = payouts.reduce((a, p) => a + p.computed.netCents, 0);
  const cfg = sumupConfig();

  const todos = [
    { n: pendingProducts + pendingRequests, label: "produit(s) / modification(s) à valider", href: "/admin/products" },
    { n: unassigned, label: "ligne(s) de vente non attribuée(s)", href: "/admin/sales?filter=unassigned" },
    { n: outOfStock, label: "produit(s) actif(s) en rupture", href: "/admin/products?tab=all&stock=out" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <AutoRefresh seconds={30} />
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de la boutique Conserve." actions={<GlobalRevenueButton />} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="CA du jour" value={euros(day.cents)} hint={<span className="text-sm text-muted">{day.count} vente(s)</span>} />
        <StatCard label="CA du mois" value={euros(month.cents)} hint={<span className="text-sm text-muted">{month.count} vente(s)</span>} />
        <StatCard label="Commission Conserve (mois)" value={euros(commission)} accent />
        <StatCard label="Net à reverser (mois)" value={euros(toPay)} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">À traiter</h2>
          <ul className="space-y-2">
            {todos.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-cream">
                  {t.n > 0 ? <AlertTriangle size={18} className="text-coral-500" /> : <CheckCircle2 size={18} className="text-success" />}
                  <span className="flex-1">
                    <strong>{t.n}</strong> {t.label}
                  </span>
                  <ArrowRight size={16} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Synchronisation SumUp</h2>
          <p>
            Mode : <strong>{cfg.mode === "live" ? "Live (API SumUp)" : cfg.mode === "mock" ? "Simulation (mock)" : "Désactivé"}</strong>
          </p>
          <p className="mt-1 text-muted">Dernière exécution : {lastRun ? relativeLabel(new Date(lastRun)) : "jamais"}</p>
          {lastError && <p className="mt-2 rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-600">{lastError}</p>}
          <Link href="/admin/settings" className="mt-4 inline-flex items-center gap-1 font-medium underline">
            Paramètres SumUp <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <h2 className="mb-4 text-xl font-semibold">Ventes du jour</h2>
      {feed.length === 0 ? <p className="text-muted">Aucune vente aujourd&apos;hui.</p> : <SaleFeed sales={feed} />}
    </div>
  );
}
