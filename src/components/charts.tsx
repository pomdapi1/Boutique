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

const PLUM_BAR = "#e7dfe3";
const CORAL = "#f25f5c";

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
              <rect width="7" height="7" fill={CORAL} />
              <rect width="3" height="7" fill="#f78a87" />
            </pattern>
          </defs>
          <XAxis
            dataKey="month"
            tickFormatter={monthShortLabel}
            axisLine={{ stroke: "#ebe8e3" }}
            tickLine={false}
            tick={{ fill: "#6f6866", fontSize: 13 }}
          />
          <YAxis hide domain={[0, max * 1.12]} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(58,11,36,0.04)" }} />
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke="#b9a7b0"
              strokeDasharray="5 5"
              label={{ value: `${averageLabel} ${eurosFr(average, 0)}`, position: "insideTopLeft", fill: "#6f6866", fontSize: 12 }}
            />
          )}
          <Bar dataKey="grossCents" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.month === currentMonth ? "url(#hatch)" : PLUM_BAR} />
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
                    fill={d.month === currentMonth ? "#3a0b24" : "#6f6866"}
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
            stroke={CORAL}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === data.length - 1 ? <circle key="last" cx={p.cx} cy={p.cy} r={4} fill={CORAL} stroke="#fbefee" strokeWidth={2} /> : <g key={p.index} />
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
