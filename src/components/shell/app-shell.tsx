import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/session";
import { listNotificationsFor } from "@/lib/notifications";
import { Sidebar, type NavItem } from "./sidebar";
import { NotificationBell } from "./notification-bell";

export async function AppShell({
  user,
  displayName,
  roleLabel,
  nav,
  children,
}: {
  user: { id: string; role: string; creatorId: string | null; email: string };
  displayName: string;
  roleLabel: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const notifications = await listNotificationsFor(user);
  return (
    <div className="flex min-h-screen">
      <Sidebar nav={nav} displayName={displayName} roleLabel={roleLabel} email={user.email}
        accountHref={user.role === "ADMIN" ? "/admin/account" : "/creator/account"}
        logout={logoutAction}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center justify-end gap-6 border-b border-line px-6 sm:px-10">
          <NotificationBell
            items={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
          />
          <form action={logoutAction}>
            <button className="flex items-center gap-3 text-muted hover:text-ink">
              <LogOut size={20} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </form>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-10">{children}</main>
      </div>
    </div>
  );
}
