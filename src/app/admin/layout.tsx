import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [pendingProducts, pendingRequests, unassigned] = await Promise.all([
    prisma.product.count({ where: { status: "PENDING" } }),
    prisma.productRequest.count({ where: { status: "PENDING" } }),
    prisma.saleItem.count({ where: { creatorId: null, sale: { status: "SUCCESSFUL" } } }),
  ]);
  return (
    <AppShell
      user={user}
      displayName="Boutique"
      roleLabel="Administrateur"
      nav={[
        { href: "/admin", label: "Tableau de bord", icon: "dashboard" },
        { href: "/admin/sales", label: "Ventes", icon: "cart", badge: unassigned },
        { href: "/admin/products", label: "Produits", icon: "package", badge: pendingProducts + pendingRequests },
        { href: "/admin/creators", label: "Créateurs", icon: "users" },
        { href: "/admin/payouts", label: "Reversements", icon: "wallet" },
        { href: "/admin/stats", label: "Statistiques", icon: "chart" },
        { href: "/admin/notifications", label: "Notifications", icon: "bell" },
        { href: "/admin/settings", label: "Paramètres & SumUp", icon: "settings" },
      ]}
    >
      {children}
    </AppShell>
  );
}
