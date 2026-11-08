"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
  Bell,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

const ICONS = {
  shop: ShoppingBag,
  cart: ShoppingCart,
  package: Package,
  chart: BarChart3,
  file: FileText,
  dashboard: LayoutDashboard,
  users: Users,
  wallet: Wallet,
  settings: Settings,
  bell: Bell,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function Sidebar({
  nav,
  displayName,
  roleLabel,
  email,
  logout,
}: {
  nav: NavItem[];
  displayName: string;
  roleLabel: string;
  email: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const content = (
    <div className="flex h-full flex-col bg-sage-900 text-white">
      <div className="flex h-24 items-center justify-between px-6">
        {!collapsed && <span className="logo text-[2.6rem] text-sage-300">BOUTIQUE</span>}
        <button
          className="hidden text-white/50 hover:text-white lg:block"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        >
          {collapsed ? <PanelLeftOpen size={22} /> : <PanelLeftClose size={22} />}
        </button>
        <button className="text-white/70 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu">
          <X size={22} />
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex items-center gap-4 rounded-lg px-3 py-2.5 text-[1.05rem] transition",
                active ? "bg-sage-700/80 font-semibold" : "text-white/85 hover:bg-sage-800",
              )}
            >
              {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded bg-sage-300" />}
              <Icon size={20} strokeWidth={1.75} />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.badge ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sage-200 px-1.5 text-xs font-semibold text-sage-900">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="relative p-3" ref={menuRef}>
        {menuOpen && (
          <div className="absolute right-3 bottom-full left-3 mb-2 overflow-hidden rounded-xl bg-white text-ink shadow-lg">
            <div className="border-b border-line px-4 py-3">
              <div className="font-semibold">{displayName}</div>
              <div className="truncate text-sm text-muted">{email}</div>
            </div>
            <form action={logout}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream">
                <LogOut size={18} /> Déconnexion
              </button>
            </form>
          </div>
        )}
        <button
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-sage-800"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sage-700 text-sm font-semibold">
            {initials(displayName)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{displayName}</span>
                <span className="block text-sm text-white/60">{roleLabel}</span>
              </span>
              <ChevronsUpDown size={18} className="text-white/60" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="fixed top-6 left-4 z-30 rounded-lg bg-sage-900 p-2 text-white lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 lg:block", collapsed ? "w-20" : "w-80")}>{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">{content}</aside>
        </div>
      )}
    </>
  );
}
