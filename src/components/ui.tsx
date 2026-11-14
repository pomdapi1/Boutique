import Link from "next/link";
import { cn } from "@/lib/utils";
import { PRODUCT_STATUS_LABEL } from "@/lib/constants";

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="mt-2 text-muted">{subtitle}</div>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card p-6", className)}>
      <div className="text-sm text-muted">{label}</div>
      <div className={cn("mt-3 text-3xl font-bold", accent ? "text-sage-600" : "text-ink")}>{value}</div>
      {hint && <div className="mt-2">{hint}</div>}
    </div>
  );
}

export function Trend({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return <span className="text-xs text-muted">— {label}</span>;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
        up ? "bg-success-bg text-success" : "bg-danger-50 text-danger-600",
      )}
    >
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {pct} % <span className="opacity-70">{label}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-sage-600 text-white",
    PENDING: "bg-amber-100 text-amber-800",
    REJECTED: "bg-sage-100 text-sage-800",
    ARCHIVED: "bg-line text-muted",
  };
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", styles[status] ?? "bg-line")}>
      {PRODUCT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "coral" | "green" | "amber" }) {
  const t = {
    neutral: "bg-sage-50 text-sage-800",
    coral: "bg-danger-100 text-danger-600",
    green: "bg-success-bg text-success",
    amber: "bg-amber-100 text-amber-800",
  }[tone];
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", t)}>{children}</span>;
}

export function TabLinks({
  tabs,
  active,
}: {
  tabs: { key: string; label: string; href: string; badge?: number }[];
  active: string;
}) {
  return (
    <div className="inline-flex gap-1 rounded-2xl bg-sage-50 p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition",
            active === t.key ? "bg-sage-900 text-white" : "text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.badge ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sage-600 px-1 text-xs text-white">
              {t.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card p-10 text-center text-muted">{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-lg font-semibold">{children}</h2>
      {right && <div className="font-semibold">{right}</div>}
    </div>
  );
}
