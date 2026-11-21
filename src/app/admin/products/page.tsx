import { Check, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/money";
import { canonicalSumupName, normalize } from "@/lib/attribution";
import { relativeLabel } from "@/lib/dates";
import { EmptyState, PageHeader, StatusBadge, TabLinks } from "@/components/ui";
import { ParamSelect, SearchInput } from "@/components/filters";
import { AdminProductDialog } from "@/components/admin-product-dialog";
import {
  adminUpdateProductAction,
  approveProductAction,
  decideRequestAction,
  importAllProductsAction,
  rejectProductAction,
} from "@/app/actions/admin";
import { ProductExcelActions } from "@/components/product-import";

type SP = Promise<Record<string, string | undefined>>;

function describeChanges(raw: string, p: { reference: string | null; name: string; priceCents: number; category: string | null }) {
  const c = JSON.parse(raw) as { reference?: string; name?: string; priceCents?: number; category?: string };
  const out: string[] = [];
  if (c.reference !== undefined) out.push(`Référence : ${p.reference ?? "—"} → ${c.reference}`);
  if (c.name !== undefined) out.push(`Nom : « ${p.name} » → « ${c.name} »`);
  if (c.priceCents !== undefined) out.push(`Prix : ${euros(p.priceCents)} → ${euros(c.priceCents)}`);
  if (c.category !== undefined) out.push(`Catégorie : ${p.category ?? "—"} → ${c.category}`);
  return out;
}

export default async function AdminProductsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab === "all" ? "all" : "pending";

  const [pendingProducts, requests, creators] = await Promise.all([
    prisma.product.findMany({ where: { status: "PENDING" }, include: { creator: true }, orderBy: { createdAt: "asc" } }),
    prisma.productRequest.findMany({ where: { status: "PENDING" }, include: { product: true, creator: true }, orderBy: { createdAt: "asc" } }),
    prisma.creator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pendingCount = pendingProducts.length + requests.length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Produits" subtitle="Validation des nouveaux produits et des demandes de modification." />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <TabLinks
          active={tab}
          tabs={[
            { key: "pending", label: "À valider", href: "?tab=pending", badge: pendingCount },
            { key: "all", label: "Tous les produits", href: "?tab=all" },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <ProductExcelActions
            action={importAllProductsAction}
            exportHref="/api/admin/products/export"
            title="Importer le catalogue de la boutique (Excel)"
            editHint="Modifiez les lignes ou ajoutez-en : la colonne Marque désigne le créateur ; laissez l'identifiant vide pour un nouveau produit."
            warning="Les noms, prix, références, stocks, statuts et noms SumUp du fichier remplacent immédiatement ceux saisis par les créateurs, sans passer par leur validation. Les créateurs concernés seront notifiés. Exportez d'abord le catalogue pour garder une sauvegarde."
          />
        </div>
      </div>
      {tab === "pending" ? (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Nouveaux produits ({pendingProducts.length})</h2>
            {pendingProducts.length === 0 ? (
              <EmptyState>Aucun nouveau produit en attente.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {pendingProducts.map((p) => {
                  const canonical = canonicalSumupName({ code: p.code, name: p.name, creatorName: p.creator.name });
                  return (
                    <li key={p.id} className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                      <div className="flex-1">
                        <div className="font-semibold">
                          {p.code} - {p.name}{" "}
                          <span className="font-normal text-muted">
                            — {p.creator.name}
                            {p.creator.ownerName ? ` (${p.creator.ownerName})` : ""}
                          </span>
                        </div>
                        <div className="text-sm text-muted">
                          Réf. {p.reference ?? "—"} · {euros(p.priceCents)} · stock {p.stock} · {p.category ?? p.creator.name} · demandé {relativeLabel(p.createdAt)}
                        </div>
                      </div>
                      <form action={approveProductAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <input name="sumupName" defaultValue={canonical} className="input w-80 py-2" aria-label="Nom dans SumUp" title="Nom de l'article dans la caisse SumUp" />
                        <button className="btn btn-primary btn-sm">
                          <Check size={16} /> Valider
                        </button>
                      </form>
                      <form action={rejectProductAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <input name="note" placeholder="Motif (optionnel)" className="input w-44 py-2" />
                        <button className="btn btn-danger btn-sm">
                          <X size={16} /> Refuser
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            {pendingProducts.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                Pensez à créer l&apos;article dans la caisse SumUp avec exactement ce nom pour que les ventes soient attribuées automatiquement.
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Demandes de modification ({requests.length})</h2>
            {requests.length === 0 ? (
              <EmptyState>Aucune demande en attente.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {requests.map((r) => (
                  <li key={r.id} className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                    <div className="flex-1">
                      <div className="font-semibold">
                        {r.product.code} - {r.product.name} <span className="font-normal text-muted">— {r.creator.name}</span>
                      </div>
                      <ul className="mt-1 text-sm text-muted">
                        {describeChanges(r.changes, r.product).map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </div>
                    <form action={decideRequestAction} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <button name="decision" value="approve" className="btn btn-primary btn-sm">
                        <Check size={16} /> Appliquer
                      </button>
                      <button name="decision" value="reject" className="btn btn-danger btn-sm">
                        <X size={16} /> Refuser
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {requests.length > 0 && <p className="mt-3 text-sm text-muted">Après application, mettez aussi à jour le nom ou le prix dans la caisse SumUp.</p>}
          </section>
        </div>
      ) : (
        <AllProducts sp={sp} creators={creators} />
      )}
    </div>
  );
}

async function AllProducts({ sp, creators }: { sp: Record<string, string | undefined>; creators: { id: string; name: string }[] }) {
  const q = sp.q ?? "";
  const creatorId = sp.creator ?? "";
  let products = await prisma.product.findMany({
    where: {
      ...(creatorId ? { creatorId } : {}),
      ...(sp.stock === "out" ? { stock: { lte: 0 }, status: "ACTIVE" } : {}),
    },
    include: { creator: { select: { name: true, ownerName: true } } },
    orderBy: [{ creator: { name: "asc" } }, { code: "asc" }],
  });
  if (q) {
    const nq = normalize(q);
    products = products.filter((p) =>
      normalize(`${p.code} ${p.reference ?? ""} ${p.name} ${p.creator.name} ${p.creator.ownerName ?? ""}`).includes(nq),
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={q} placeholder="Produit, référence, marque…" />
        <ParamSelect
          name="creator"
          label="Marque"
          value={creatorId}
          options={[{ value: "", label: "Toutes les marques" }, ...creators.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <ParamSelect
          name="stock"
          label="Stock"
          value={sp.stock ?? ""}
          options={[
            { value: "", label: "Tous les stocks" },
            { value: "out", label: "En rupture" },
          ]}
        />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left">
          <thead className="border-b border-line whitespace-nowrap text-muted">
            <tr>
              <th className="px-4 py-4 font-semibold">Référence</th>
              <th className="px-4 py-4 font-semibold">Produit</th>
              <th className="px-4 py-4 font-semibold">Marque</th>
              <th className="px-4 py-4 font-semibold">Nom du créateur</th>
              <th className="px-4 py-4 text-right font-semibold">Prix</th>
              <th className="px-4 py-4 text-right font-semibold">Stock</th>
              <th className="px-4 py-4 font-semibold">Statut</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-cream/60">
                <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
                  {p.reference ?? <span className="font-sans text-muted italic">à renseigner</span>}
                </td>
                <td className="px-4 py-3">
                  {p.code} - {p.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{p.creator.name}</td>
                <td className="px-4 py-3 whitespace-nowrap">{p.creator.ownerName ?? <span className="text-muted">—</span>}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{euros(p.priceCents)}</td>
                <td className={`px-4 py-3 text-right ${p.stock <= 0 ? "text-danger-600" : ""}`}>{p.stock}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <AdminProductDialog
                    action={adminUpdateProductAction}
                    product={{ ...p, canonical: canonicalSumupName({ code: p.code, name: p.name, creatorName: p.creator.name }) }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="p-8 text-center text-muted">Aucun produit.</p>}
      </div>
    </>
  );
}
