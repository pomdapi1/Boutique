import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readDocumentFile } from "@/lib/documents";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  // Un créateur ne peut lire que ses propres documents ; l'admin lit tout.
  if (!doc || (user.role !== "ADMIN" && doc.creatorId !== user.creatorId))
    return new NextResponse("Introuvable", { status: 404 });

  try {
    const file = await readDocumentFile(doc);
    // Images (vignettes des photos) affichées dans la page ; PDF toujours téléchargés,
    // pour qu'un PDF piégé ne s'ouvre jamais dans l'origine du site.
    const disposition = doc.mimeType.startsWith("image/") ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Fichier manquant", { status: 410 });
  }
}
