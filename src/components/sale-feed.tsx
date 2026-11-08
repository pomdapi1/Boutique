import { ChevronDown, CreditCard, Banknote } from "lucide-react";
import { euros } from "@/lib/money";
import { timeLabel } from "@/lib/dates";
import { groupByDay, itemDisplay, type FeedSale } from "@/lib/feed";
import { cn } from "@/lib/utils";
import { PAYMENT_LABEL } from "@/lib/constants";

function PaymentIcon({ type }: { type: string }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eef2fb] text-card-blue">
      {type === "CASH" ? <Banknote size={20} /> : <CreditCard size={20} />}
    </span>
  );
}

/** Feed des paniers : une ligne par vente, détail dépliable si plusieurs articles. */
export function SaleFeed({
  sales,
  highlightCreatorId,
  extra,
}: {
  sales: FeedSale[];
  highlightCreatorId?: string;
  extra?: (sale: FeedSale) => React.ReactNode;
}) {
  const groups = groupByDay(sales, (s) => s.occurredAt);
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="eyebrow text-sm">{g.label}</h2>
            <span className="font-semibold text-plum-900">
              {euros(g.rows.filter((s) => s.status === "SUCCESSFUL").reduce((a, s) => a + s.totalCents, 0))}
            </span>
          </div>
          <ul className="card divide-y divide-line overflow-hidden">
            {g.rows.map((sale) => {
              const mine = highlightCreatorId && sale.items.some((i) => i.creatorId === highlightCreatorId);
              const title = sale.items
                .map((it) => {
                  const d = itemDisplay(it);
                  return `${it.quantity > 1 ? `${it.quantity} × ` : ""}${d.title}${d.creator ? ` — ${d.creator}` : ""}`;
                })
                .join(", ");
              const multi = sale.items.length > 1;
              const header = (
                <div className="relative flex items-center gap-4 px-5 py-4">
                  {mine && (
                    <span className="absolute top-3 left-2 h-2.5 w-2.5 rounded-full border-2 border-coral-600" title="Contient un de vos produits" />
                  )}
                  <PaymentIcon type={sale.paymentType} />
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate font-medium", sale.status === "REFUNDED" && "line-through opacity-60")}>{title}</div>
                    <div className="text-sm text-muted">
                      {timeLabel(sale.occurredAt)} · {PAYMENT_LABEL[sale.paymentType]}
                      {sale.status === "REFUNDED" && " · Remboursée"}
                      {sale.source === "SIMULATION" && " · simulation"}
                    </div>
                  </div>
                  {extra?.(sale)}
                  <span className="shrink-0 font-semibold">{euros(sale.totalCents)}</span>
                  <span className="w-5 shrink-0 text-muted">
                    {multi && <ChevronDown size={18} className="transition group-open:rotate-180" />}
                  </span>
                </div>
              );
              return (
                <li key={sale.id}>
                  {multi ? (
                    <details className="group">
                      <summary className="cursor-pointer list-none hover:bg-cream/60 [&::-webkit-details-marker]:hidden">{header}</summary>
                      <ul className="divide-y divide-line bg-cream/50">
                        {sale.items.map((it) => {
                          const d = itemDisplay(it);
                          const isMine = highlightCreatorId && it.creatorId === highlightCreatorId;
                          return (
                            <li key={it.id} className="relative flex items-center gap-3 py-3 pr-14 pl-16 text-sm">
                              {isMine && <span className="absolute left-10 h-2.5 w-2.5 rounded-full border-2 border-coral-600" />}
                              <span className="text-muted">x{it.quantity}</span>
                              <span className="flex-1">
                                {d.title}
                                {d.creator ? <span className="text-muted"> — {d.creator}</span> : <span className="text-coral-600"> (non attribué)</span>}
                              </span>
                              <span className="text-muted">{euros(it.totalCents)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : (
                    header
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
