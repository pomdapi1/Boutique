import { requireCreator } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { user, creator } = await requireCreator();
  return (
    <AppShell
      user={user}
      displayName={creator.name}
      roleLabel="Créateur"
      nav={[
        { href: "/creator/boutique", label: "La boutique", icon: "shop" },
        { href: "/creator/sales", label: "Mes ventes", icon: "cart" },
        { href: "/creator/products", label: "Mes produits", icon: "package" },
        { href: "/creator/stats", label: "Statistiques", icon: "chart" },
        { href: "/creator/documents", label: "Mes documents", icon: "file" },
      ]}
    >
      {children}
    </AppShell>
  );
}
