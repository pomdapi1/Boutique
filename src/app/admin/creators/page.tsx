import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { computePayouts } from "@/lib/stats";
import { monthKey } from "@/lib/dates";
import { euros } from "@/lib/money";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { getDefaultCommissionRate } from "@/lib/settings";
import { PageHeader, Pill } from "@/components/ui";
import { Modal } from "@/components/modal";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createCreatorAction } from "@/app/actions/admin";
import { DeleteCreatorButton } from "@/components/delete-creator";

export default async function CreatorsPage() {
  const m = monthKey(new Date());
  const [creators, payouts, defaultRate, productCounts] = await Promise.all([
    prisma.creator.findMany({
      orderBy: { name: "asc" },
      include: {
        user: { select: { email: true, lastLoginAt: true } },
        documents: { select: { type: true } },
        _count: { select: { products: { where: { status: "ACTIVE" } }, saleItems: true, payouts: true } },
      },
    }),
    computePayouts(m),
    getDefaultCommissionRate(),
    prisma.product.groupBy({ by: ["creatorId"], _count: true }),
  ]);
  const grossMap = new Map(payouts.map((p) => [p.creator.id, p.computed.grossCents]));
  const allProducts = new Map(productCounts.map((g) => [g.creatorId, g._count]));
  const required = DOCUMENT_TYPES.filter((t) => t.type !== "INVOICE");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Créateurs"
        subtitle={`${creators.length} créateur(s) · commission par défaut ${Math.round(defaultRate * 100)} %`}
        actions={
          <Modal
            title="Nouveau créateur"
            triggerClassName="btn btn-primary"
            trigger={
              <>
                <Plus size={18} /> Ajouter un créateur
              </>
            }
          >
            <ActionForm action={createCreatorAction} resetOnSuccess className="space-y-4">
              <div>
                <label className="label" htmlFor="new-owner">
                  Nom du créateur
                </label>
                <input id="new-owner" name="ownerName" required autoComplete="off" placeholder="Marie Dupont" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="new-brand">
                  Nom de la marque
                </label>
                <input id="new-brand" name="name" required autoComplete="off" placeholder="Le jardin du crochet" className="input" />
                <p className="mt-1 text-xs text-muted">Affiché dans l&apos;application et utilisé dans les noms d&apos;articles de la caisse SumUp.</p>
              </div>
              <div>
                <label className="label" htmlFor="new-email">
                  Email de connexion
                </label>
                <input id="new-email" name="email" type="email" required autoComplete="off" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="new-password">
                  Mot de passe provisoire
                </label>
                <input id="new-password" name="password" type="text" minLength={8} required autoComplete="off" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="new-commission">
                  Commission Les Songes Créatifs (%)
                </label>
                <input id="new-commission" name="commission" type="number" step="0.5" min={0} max={100} placeholder={String(Math.round(defaultRate * 100))} className="input" />
              </div>
              <SubmitButton className="w-full">Créer le compte</SubmitButton>
            </ActionForm>
          </Modal>
        }
      />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-5 py-4 font-semibold">Marque / créateur</th>
              <th className="px-5 py-4 text-right font-semibold">Commission</th>
              <th className="px-5 py-4 text-right font-semibold">Produits actifs</th>
              <th className="px-5 py-4 text-right font-semibold">CA du mois</th>
              <th className="px-5 py-4 font-semibold">Documents</th>
              <th className="px-5 py-4 font-semibold">Statut</th>
              <th className="px-5 py-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {creators.map((c) => {
              const missing = required.filter((t) => !c.documents.some((d) => d.type === t.type));
              return (
                <tr key={c.id} className="hover:bg-cream/60">
                  <td className="px-5 py-4">
                    <Link href={`/admin/creators/${c.id}`} className="font-semibold hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-sm text-muted">
                      {c.ownerName ?? <span className="italic">nom du créateur à renseigner</span>} · {c.user?.email ?? "—"}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">{Math.round(c.commissionRate * 1000) / 10} %</td>
                  <td className="px-5 py-4 text-right">{c._count.products}</td>
                  <td className="px-5 py-4 text-right">{euros(grossMap.get(c.id) ?? 0)}</td>
                  <td className="px-5 py-4">
                    {missing.length === 0 ? <Pill tone="green">Complet</Pill> : <Pill tone="amber">Manque : {missing.map((t) => t.label).join(", ")}</Pill>}
                  </td>
                  <td className="px-5 py-4">{c.active ? <Pill tone="green">Actif</Pill> : <Pill>Désactivé</Pill>}</td>
                  <td className="px-5 py-4 text-right">
                    <DeleteCreatorButton
                      compact
                      creator={{
                        id: c.id,
                        name: c.name,
                        active: c.active,
                        sales: c._count.saleItems,
                        payouts: c._count.payouts,
                        products: allProducts.get(c.id) ?? 0,
                        documents: c.documents.length,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
