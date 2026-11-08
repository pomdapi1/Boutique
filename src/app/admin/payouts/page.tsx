import { FileText, Lock } from "lucide-react";
import { computePayouts } from "@/lib/stats";
import { monthKey, monthLabel, parseMonthKey, shiftMonth } from "@/lib/dates";
import { euros } from "@/lib/money";
import { EmptyState, PageHeader, Pill } from "@/components/ui";
import { MonthNav } from "@/components/filters";
import { closeMonthAction, reopenPayoutAction, togglePayoutPaidAction } from "@/app/actions/admin";

type SP = Promise<Record<string, string | undefined>>;

export default async function PayoutsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const month = parseMonthKey(sp.m, new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const rows = await computePayouts(month);
  const ongoing = month >= monthKey(new Date());
  const unclosed = rows.filter((r) => !r.payout).length;

  const tot = rows.reduce(
    (a, r) => {
      const v = r.payout ?? r.computed;
      return {
        gross: a.gross + v.grossCents,
        fee: a.fee + v.feeCents,
        com: a.com + v.commissionCents,
        net: a.net + v.netCents,
      };
    },
    { gross: 0, fee: 0, com: 0, net: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reversements"
        subtitle="Net à reverser = CA brut − frais SumUp − commission Les Songes Créatifs (sur le CA brut)."
        actions={
          unclosed > 0 && !ongoing ? (
            <form action={closeMonthAction}>
              <input type="hidden" name="month" value={month} />
              <button className="btn btn-dark">
                <Lock size={18} /> Clôturer {monthLabel(month)}
              </button>
            </form>
          ) : null
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <MonthNav month={month} />
        {ongoing && <span className="text-sm text-muted">Mois en cours : montants provisoires, clôture possible à partir du {`1er ${monthLabel(shiftMonth(month, 1))}`}.</span>}
      </div>

      {rows.length === 0 ? (
        <EmptyState>Aucune vente attribuée sur ce mois.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-4 font-semibold">Créateur</th>
                <th className="px-4 py-4 text-right font-semibold">CA brut</th>
                <th className="px-4 py-4 text-right font-semibold">Frais SumUp</th>
                <th className="px-4 py-4 text-right font-semibold">Commission</th>
                <th className="px-4 py-4 text-right font-semibold">Net à reverser</th>
                <th className="px-4 py-4 font-semibold">Statut</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ creator, computed, payout }) => {
                const v = payout ?? computed;
                const drift = payout && payout.netCents !== computed.netCents;
                return (
                  <tr key={creator.id}>
                    <td className="px-4 py-3 font-medium">{creator.name}</td>
                    <td className="px-4 py-3 text-right">{euros(v.grossCents)}</td>
                    <td className="px-4 py-3 text-right">{euros(v.feeCents)}</td>
                    <td className="px-4 py-3 text-right">
                      {euros(v.commissionCents)} <span className="text-xs text-muted">({Math.round(creator.commissionRate * 100)} %)</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{euros(v.netCents)}</td>
                    <td className="px-4 py-3">
                      {!payout ? (
                        <Pill>{ongoing ? "Provisoire" : "Non clôturé"}</Pill>
                      ) : payout.paidAt ? (
                        <Pill tone="green">Payé le {payout.paidAt.toLocaleDateString("fr-FR")}</Pill>
                      ) : (
                        <Pill tone="amber">À payer</Pill>
                      )}
                      {drift && (
                        <div className="mt-1 text-xs text-danger-600" title="Des ventes ont changé après la clôture (remboursement, attribution manuelle…)">
                          Recalcul : {euros(computed.netCents)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <a className="btn btn-ghost btn-sm" href={`/api/export/sales?creator=${creator.id}&m=${month}`} title="Relevé PDF">
                          <FileText size={16} />
                        </a>
                        {payout && (
                          <form action={togglePayoutPaidAction}>
                            <input type="hidden" name="id" value={payout.id} />
                            <button className="btn btn-outline btn-sm">{payout.paidAt ? "Annuler paiement" : "Marquer payé"}</button>
                          </form>
                        )}
                        {payout && !payout.paidAt && (
                          <form action={reopenPayoutAction}>
                            <input type="hidden" name="id" value={payout.id} />
                            <button className="btn btn-ghost btn-sm" title="Supprimer la clôture pour recalculer">
                              Rouvrir
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-line font-bold">
              <tr>
                <td className="px-4 py-4">Total</td>
                <td className="px-4 py-4 text-right">{euros(tot.gross)}</td>
                <td className="px-4 py-4 text-right">{euros(tot.fee)}</td>
                <td className="px-4 py-4 text-right">{euros(tot.com)}</td>
                <td className="px-4 py-4 text-right">{euros(tot.net)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
