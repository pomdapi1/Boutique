import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { relativeLabel } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { deleteNotificationAction, sendNotificationAction } from "@/app/actions/admin";

export default async function AdminNotificationsPage() {
  const [creators, sent] = await Promise.all([
    prisma.creator.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.notification.findMany({
      where: { forAdmin: false },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { creator: { select: { name: true } }, _count: { select: { reads: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Notifications" subtitle="Informez les créateurs (nouveautés, clôtures, événements…)." />
      <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
        <div className="card self-start p-6">
          <h2 className="mb-4 text-lg font-semibold">Nouvelle notification</h2>
          <ActionForm action={sendNotificationAction} resetOnSuccess className="space-y-4">
            <div>
              <label className="label">Destinataires</label>
              <select name="target" className="input">
                <option value="all">Tous les créateurs</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Titre</label>
              <input name="title" required maxLength={120} className="input" placeholder="Changements du 03/11" />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea name="body" required rows={4} maxLength={1000} className="input" />
            </div>
            <div>
              <label className="label">Lien (optionnel)</label>
              <input name="link" className="input" placeholder="/creator/products" />
            </div>
            <SubmitButton className="w-full">Envoyer</SubmitButton>
          </ActionForm>
        </div>
        <div>
          <h2 className="mb-4 text-lg font-semibold">Envoyées aux créateurs</h2>
          <ul className="card divide-y divide-line">
            {sent.length === 0 && <li className="p-6 text-muted">Aucune notification.</li>}
            {sent.map((n) => (
              <li key={n.id} className="flex gap-4 px-5 py-4">
                <div className="flex-1">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-sm whitespace-pre-line text-muted">{n.body}</div>
                  <div className="mt-1 text-xs text-muted">
                    {n.creator ? n.creator.name : "Tous les créateurs"} · {relativeLabel(n.createdAt)} · lue {n._count.reads} fois
                  </div>
                </div>
                <form action={deleteNotificationAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="text-muted hover:text-coral-600" aria-label="Supprimer">
                    <Trash2 size={16} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
