"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, CalendarCheck, CircleCheck, Info, PackageX, Sparkles } from "lucide-react";
import { markNotificationsReadAction } from "@/app/actions/session";
import { relativeLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  read: boolean;
};

const ICON: Record<string, typeof Bell> = {
  STOCK_OUT: PackageX,
  REQUEST: CircleCheck,
  CLOSING: CalendarCheck,
  PRODUCT: Sparkles,
  INFO: Info,
};

export function NotificationBell({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => !i.read).length;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) startTransition(() => markNotificationsReadAction());
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative text-muted hover:text-ink" aria-label="Notifications">
        <Bell size={22} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-10 right-0 z-40 w-[min(92vw,32rem)] overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <div className="border-b border-line px-5 py-4 font-semibold">Notifications</div>
          <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Aucune notification.</li>}
            {items.map((n) => {
              const Icon = ICON[n.kind] ?? Info;
              const inner = (
                <div className={cn("flex gap-4 px-5 py-4", !n.read && "bg-coral-50/60")}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream text-muted">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{n.title}</div>
                    <div className="mt-0.5 text-sm whitespace-pre-line text-muted">{n.body}</div>
                    <div className="mt-1.5 text-xs text-muted">{relativeLabel(new Date(n.createdAt))}</div>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} onClick={() => setOpen(false)} className="block hover:bg-cream">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
