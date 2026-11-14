import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/money";
import { normalize } from "@/lib/attribution";
import { PageHeader, StatusBadge, TabLinks, EmptyState, Pill } from "@/components/ui";
import { SearchInput } from "@/components/filters";
import { SortHeader } from "@/components/sort-header";
import { CreateProductDialog, DeleteProductDialog, EditProductDialog, StockDialog } from "@/components/product-dialogs";
import { adjustStockAction, createProductAction, deleteProductAction, requestProductChangeAction } from "@/app/actions/creator";

type SP = Promise<Record<string, string | undefined>>;
const SORTS = ["reference", "name", "price", "stock", "status"] as const;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const tab = sp.tab === "rupture" ? "rupture" : "catalogue";
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? sp.sort! : "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const q = sp.q ?? "";

  const all = await prisma.product.findMany({
    where: { creatorId: creator.id, status: { not: "ARCHIVED" } },
    include: { requests: { where: { status: "PENDING" }, select: { id: true } } },
  });
  const outOfStock = all.filter((p) => p.status === "ACTIVE" && p.stock <= 0);

  let rows = tab === "rupture" ? outOfStock : all;
  if (q) {
    const nq = normalize(q);
    rows = rows.filter((p) => normalize(`${p.reference ?? ""} ${p.name}`).includes(nq));
  }
  const key = (p: (typeof all)[number]) =>
    sort === "price"
      ? p.priceCents
      : sort === "stock"
        ? p.stock
        : sort === "status"
          ? p.status
          : sort === "reference"
            ? (p.reference ?? "")
            : p.name;
  rows = [...rows].sort((a, b) => {
    const ka = key(a), kb = key(b);
    const c = typeof ka === "number" ? ka - (kb as number) : String(ka).localeCompare(String(kb), "fr");
    return dir === "asc" ? c : -c;
  });

  const base = { tab, ...(q ? { q } : {}) };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Mon catalogue"
        subtitle="Les produits « En attente » doivent être validés par l'administrateur."
        actions={
          <>
            <SearchInput value={q} placeholder="Produit ou référence…" />
            <CreateProductDialog action={createProductAction} />
          </>
        }
      />
      <div className="mb-6">
        <TabLinks
          active={tab}
          tabs={[
            { key: "catalogue", label: `Catalogue (${all.length})`, href: "?tab=catalogue" },
            { key: "rupture", label: "Rupture de stock", href: "?tab=rupture", badge: outOfStock.length },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState>{tab === "rupture" ? "Aucun produit en rupture de stock." : "Aucun produit."}</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-line">
              <tr>
                <SortHeader label="Référence" field="reference" sort={sort} dir={dir} baseParams={base} />
                <SortHeader label="Nom" field="name" sort={sort} dir={dir} baseParams={base} />
                <SortHeader label="Prix" field="price" sort={sort} dir={dir} baseParams={base} className="text-right" />
                <th className="px-3 py-4 font-semibold text-muted">Marque</th>
                <SortHeader label="Quantité" field="stock" sort={sort} dir={dir} baseParams={base} className="text-right" />
                <SortHeader label="Statut" field="status" sort={sort} dir={dir} baseParams={base} />
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-cream/60">
                  <td className="px-3 py-4 font-mono text-sm whitespace-nowrap">
                    {p.reference ?? <span className="font-sans text-muted italic">à renseigner</span>}
                  </td>
                  <td className="px-3 py-4">{p.name}</td>
                  <td className="px-3 py-4 text-right whitespace-nowrap">{euros(p.priceCents)}</td>
                  <td className="px-3 py-4">{creator.name}</td>
                  <td className={`px-3 py-4 text-right font-medium ${p.stock <= 0 ? "text-danger-600" : ""}`}>{p.stock}</td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={p.status} />
                      {p.requests.length > 0 && <Pill tone="amber">Modif. en attente</Pill>}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-2">
                      {p.status !== "REJECTED" && <StockDialog product={p} action={adjustStockAction} />}
                      <EditProductDialog product={p} action={requestProductChangeAction} pending={p.requests.length > 0} />
                      <DeleteProductDialog product={p} status={p.status} action={deleteProductAction} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
