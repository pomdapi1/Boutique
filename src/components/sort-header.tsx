import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortHeader({
  label,
  field,
  sort,
  dir,
  baseParams,
  className,
}: {
  label: string;
  field: string;
  sort: string;
  dir: "asc" | "desc";
  baseParams: Record<string, string>;
  className?: string;
}) {
  const active = sort === field;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const qs = new URLSearchParams({ ...baseParams, sort: field, dir: nextDir });
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-4 py-4 font-semibold text-muted", className)}>
      <Link href={`?${qs}`} className="inline-flex items-center gap-1 hover:text-ink">
        {label} <Icon size={14} className={active ? "text-ink" : "opacity-50"} />
      </Link>
    </th>
  );
}
