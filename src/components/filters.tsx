"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { lastMonths, monthLabel, monthKey, shiftMonth } from "@/lib/dates";

function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  };
}

const selectCls =
  "h-12 rounded-xl border border-line bg-white px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-plum-100";

export function MonthNav({ month }: { month: string }) {
  const setParam = useSetParam();
  const current = monthKey(new Date());
  const options = lastMonths(current, 24).reverse();
  if (!options.includes(month)) options.unshift(month);

  return (
    <div className="flex items-center gap-2">
      <button className="btn btn-outline h-12 w-12 p-0" onClick={() => setParam("m", shiftMonth(month, -1))} aria-label="Mois précédent">
        <ChevronLeft size={18} />
      </button>
      <select className={`${selectCls} min-w-52`} value={month} onChange={(e) => setParam("m", e.target.value)} aria-label="Mois">
        {options.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
      <button
        className="btn btn-outline h-12 w-12 p-0"
        onClick={() => setParam("m", shiftMonth(month, 1))}
        disabled={month >= current}
        aria-label="Mois suivant"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function ParamSelect({
  name,
  value,
  options,
  label,
  className,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const setParam = useSetParam();
  return (
    <select
      aria-label={label}
      className={`${selectCls} ${className ?? ""}`}
      value={value}
      onChange={(e) => setParam(name, e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({ name = "q", value, placeholder }: { name?: string; value: string; placeholder: string }) {
  const setParam = useSetParam();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setParam(name, new FormData(e.currentTarget).get(name) as string);
      }}
    >
      <input name={name} defaultValue={value} placeholder={placeholder} className="input h-12 bg-white" type="search" />
    </form>
  );
}

/** Rafraîchit les données serveur périodiquement (feed "temps réel"). */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
