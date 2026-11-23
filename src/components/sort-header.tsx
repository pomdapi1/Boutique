import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** En-tête de colonne triable : un clic trie, un second clic inverse l'ordre. */
export function SortHeader({
  label,
  field,
  sort,
  dir,
  baseParams,
  className,
  wrap,
}: {
  label: string;
  field: string;
  sort: string;
  dir: "asc" | "desc";
  baseParams: Record<string, string>;
  className?: string;
  /** Autorise le libellé sur plusieurs lignes (colonnes à long titre). */
  wrap?: boolean;
}) {
  const active = sort === field;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const qs = new URLSearchParams({ ...baseParams, sort: field, dir: nextDir });
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("px-2.5 py-4 font-semibold text-muted", wrap ? "whitespace-normal" : "whitespace-nowrap", className)}
    >
      <Link href={`?${qs}`} className={cn("hover:text-ink", wrap ? "inline" : "inline-flex items-center gap-0.5")}>
        {label}
        {wrap && " "}
        <Icon size={13} aria-hidden className={cn("shrink-0", wrap && "inline align-[-1px]", active ? "text-ink" : "opacity-50")} />
      </Link>
    </th>
  );
}
