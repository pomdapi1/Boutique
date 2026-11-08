import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { DocumentsList } from "@/components/documents-list";
import { deleteDocumentAction, uploadDocumentAction } from "@/app/actions/creator";

export default async function DocumentsPage() {
  const { creator } = await requireCreator();
  const docs = await prisma.document.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Mes documents" />
      <DocumentsList docs={docs} uploadAction={uploadDocumentAction} deleteAction={deleteDocumentAction} />
    </div>
  );
}
