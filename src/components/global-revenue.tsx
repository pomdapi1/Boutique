"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { Modal } from "./modal";
import { grossByCreatorAction } from "@/app/actions/shared";
import { monthKey, monthLabel, shiftMonth } from "@/lib/dates";
import { euros } from "@/lib/money";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; grossCents: number };

function Content({ meId }: { meId?: string }) {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => setRows(await grossByCreatorAction(month)));
  }, [month]);

  const total = rows?.reduce((a, r) => a + r.grossCents, 0) ?? 0;
  const label = monthLabel(month);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button className="btn btn-outline h-12 w-12 p-0" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mois précédent">
          <ChevronLeft size={18} />
        </button>
        <span className="min-w-48 text-center text-xl font-medium">{label[0]!.toUpperCase() + label.slice(1)}</span>
        <button
          className="btn btn-outline h-12 w-12 p-0"
          disabled={month >= monthKey(new Date())}
          onClick={() => setMonth(shiftMonth(month, 1))}
          aria-label="Mois suivant"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className={cn("overflow-hidden rounded-xl border border-line", pending && "opacity-60")}>
        <table className="w-full text-left">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="px-5 py-4 font-normal">Créateur</th>
              <th className="px-5 py-4 text-right font-normal">CA brut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows?.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-muted">
                  Aucune vente ce mois-ci.
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.id} className={cn(r.id === meId && "bg-[#eef5f6] font-semibold")}>
                <td className="px-5 py-4">
                  {r.name} {r.id === meId && <span className="text-sm font-normal text-muted">(vous)</span>}
                </td>
                <td className="px-5 py-4 text-right">{euros(r.grossCents)}</td>
              </tr>
            ))}
          </tbody>
          {rows && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line font-bold">
                <td className="px-5 py-4">Total boutique</td>
                <td className="px-5 py-4 text-right">{euros(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function GlobalRevenueButton({ meId }: { meId?: string }) {
  return (
    <Modal
      title="CA global de la boutique"
      wide
      triggerClassName="btn btn-dark px-6 py-3 text-base"
      trigger={
        <>
          <TrendingUp size={18} /> CA global
        </>
      }
    >
      <Content meId={meId} />
    </Modal>
  );
}
