import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getKit } from "@/lib/kit";
import { PHOTO_TYPE } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { DocumentsList } from "@/components/documents-list";
import { CommunicationSection } from "@/components/communication-section";
import {
  deleteDocumentAction,
  saveCommunicationTextsAction,
  uploadDocumentAction,
} from "@/app/actions/creator";

export default async function DocumentsPage() {
  const { creator } = await requireCreator();
  const [docs, kit] = await Promise.all([
    prisma.document.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "asc" } }),
    getKit(),
  ]);
  const photos = docs.filter((d) => d.type === PHOTO_TYPE.type);
  const adminDocs = docs.filter((d) => d.type !== PHOTO_TYPE.type).reverse();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Mes documents" />
      <DocumentsList docs={adminDocs} uploadAction={uploadDocumentAction} deleteAction={deleteDocumentAction} />
      <div className="mt-6">
        <CommunicationSection
          photos={photos}
          brandPitch={creator.brandPitch}
          salesNotes={creator.salesNotes}
          kit={kit}
          uploadAction={uploadDocumentAction}
          deleteAction={deleteDocumentAction}
          textsAction={saveCommunicationTextsAction}
        />
      </div>
    </div>
  );
}
