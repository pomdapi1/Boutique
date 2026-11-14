import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/money";
import { monthKey, monthLabel, shiftMonth } from "@/lib/dates";
import { PageHeader, StatusBadge, Pill } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { DocumentsList } from "@/components/documents-list";
import { resetPasswordAction, updateCreatorAction } from "@/app/actions/admin";

export default async function CreatorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creator = await prisma.creator.findUnique({
    where: { id },
    include: {
      user: true,
      documents: { orderBy: { createdAt: "desc" } },
      products: { orderBy: { code: "asc" } },
      payouts: { orderBy: { month: "desc" }, take: 12 },
    },
  });
  if (!creator) notFound();
  const lastMonth = shiftMonth(monthKey(new Date()), -1);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/creators" className="mb-4 inline-flex items-center gap-1 text-muted hover:text-ink">
        <ArrowLeft size={16} /> Créateurs
      </Link>
      <PageHeader
        title={creator.name}
        subtitle={`${creator.ownerName ? `${creator.ownerName} · ` : ""}${
          creator.user?.lastLoginAt ? `Dernière connexion : ${creator.user.lastLoginAt.toLocaleString("fr-FR")}` : "Jamais connecté"
        }`}
        actions={
          <a className="btn btn-outline" href={`/api/export/sales?creator=${creator.id}&m=${lastMonth}`}>
            <FileText size={18} /> Relevé {monthLabel(lastMonth)}
          </a>
        }
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Informations</h2>
          <ActionForm action={updateCreatorAction} className="space-y-4">
            <input type="hidden" name="id" value={creator.id} />
            <div>
              <label className="label" htmlFor="owner">
                Nom du créateur
              </label>
              <input id="owner" name="ownerName" defaultValue={creator.ownerName ?? ""} required placeholder="Marie Dupont" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="brand">
                Nom de la marque
              </label>
              <input id="brand" name="name" defaultValue={creator.name} required className="input" />
              <p className="mt-1 text-xs text-muted">
                Doit correspondre au nom utilisé dans les articles de la caisse SumUp : si vous le changez, renommez aussi les articles.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email de connexion
              </label>
              <input id="email" name="email" type="email" defaultValue={creator.user?.email ?? creator.contactEmail ?? ""} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="commission">
                Commission Les Songes Créatifs (%)
              </label>
              <input
                id="commission"
                name="commission"
                type="number"
                step="0.5"
                min={0}
                max={100}
                defaultValue={Math.round(creator.commissionRate * 1000) / 10}
                required
                className="input"
              />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={creator.active} className="h-4 w-4 accent-sage-900" /> Compte actif
            </label>
            <SubmitButton>Enregistrer</SubmitButton>
          </ActionForm>
        </div>
        <div className="card self-start p-6">
          <h2 className="mb-4 text-lg font-semibold">Réinitialiser le mot de passe</h2>
          <ActionForm action={resetPasswordAction} resetOnSuccess className="space-y-4">
            <input type="hidden" name="creatorId" value={creator.id} />
            <input name="password" type="text" minLength={8} required placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe" className="input" />
            <SubmitButton className="btn-dark">Mettre à jour</SubmitButton>
          </ActionForm>
        </div>
      </div>

      <h2 className="mb-4 text-xl font-semibold">Documents</h2>
      <div className="mb-10">
        <DocumentsList docs={creator.documents} />
      </div>

      <h2 className="mb-4 text-xl font-semibold">Produits ({creator.products.length})</h2>
      <div className="card mb-10 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left">
          <tbody className="divide-y divide-line">
            {creator.products.map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3">
                  {p.code} - {p.name}
                </td>
                <td className="px-5 py-3 text-right">{euros(p.priceCents)}</td>
                <td className={`px-5 py-3 text-right ${p.stock <= 0 ? "text-danger-600" : ""}`}>{p.stock}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-4 text-xl font-semibold">Reversements clôturés</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <tbody className="divide-y divide-line">
            {creator.payouts.length === 0 && (
              <tr>
                <td className="px-5 py-4 text-muted">Aucune clôture.</td>
              </tr>
            )}
            {creator.payouts.map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3 capitalize">{monthLabel(p.month)}</td>
                <td className="px-5 py-3 text-right">Brut {euros(p.grossCents)}</td>
                <td className="px-5 py-3 text-right font-semibold">Net {euros(p.netCents)}</td>
                <td className="px-5 py-3">{p.paidAt ? <Pill tone="green">Payé</Pill> : <Pill tone="amber">À payer</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
