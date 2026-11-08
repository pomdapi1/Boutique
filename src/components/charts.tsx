"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthShortLabel } from "@/lib/dates";
import { eurosFr } from "@/lib/money";

type Point = { month: string; grossCents: number };

const BAR = "#d2d6c5"; // sage-200
const ACCENT = "#626850"; // sage-600

function TooltipBox({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-line bg-cream px-4 py-2.5 text-sm shadow-sm">
      {monthShortLabel(p.month)} : <strong>{eurosFr(p.grossCents)}</strong>
    </div>
  );
}

/** Évolution du CA sur 12 mois — une série, ligne de moyenne, mois courant hachuré. */
export function MonthlyRevenueChart({
  data,
  average,
  currentMonth,
  averageLabel,
}: {
  data: Point[];
  average: number;
  currentMonth: string;
  averageLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.grossCents), average, 1);
  const peak = data.reduce((a, d) => (d.grossCents > a.grossCents ? d : a), data[0]!);
  return (
    <div className="h-80 w-full" role="img" aria-label={`Évolution du CA sur 12 mois, moyenne ${eurosFr(average, 0)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 28, right: 8, left: 8, bottom: 0 }} barCategoryGap="30%">
          <defs>
            <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill={ACCENT} />
              <rect width="3" height="7" fill="#959b80" />
            </pattern>
          </defs>
          <XAxis
            dataKey="month"
            tickFormatter={monthShortLabel}
            axisLine={{ stroke: "#e8e7df" }}
            tickLine={false}
            tick={{ fill: "#66695e", fontSize: 13 }}
          />
          <YAxis hide domain={[0, max * 1.12]} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(47,50,39,0.05)" }} />
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke="#959b80"
              strokeDasharray="5 5"
              label={{ value: `${averageLabel} ${eurosFr(average, 0)}`, position: "insideTopLeft", fill: "#66695e", fontSize: 12 }}
            />
          )}
          <Bar dataKey="grossCents" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.month === currentMonth ? "url(#hatch)" : BAR} />
            ))}
            <LabelList
              dataKey="grossCents"
              position="top"
              content={(props) => {
                const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
                const d = data[index];
                if (!d || !value || (d.month !== currentMonth && d !== peak)) return null;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 8}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={d.month === currentMonth ? 600 : 400}
                    fill={d.month === currentMonth ? "#2f3227" : "#66695e"}
                  >
                    {eurosFr(value, 0)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mini-courbe décorative de la carte "net à reverser" (6 derniers mois). */
export function Sparkline({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-20 w-60" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <YAxis hide domain={[0, "dataMax"]} />
          <Line
            type="linear"
            dataKey="v"
            stroke={ACCENT}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === data.length - 1 ? <circle key="last" cx={p.cx} cy={p.cy} r={4} fill={ACCENT} stroke="#f4f5f0" strokeWidth={2} /> : <g key={p.index} />
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
