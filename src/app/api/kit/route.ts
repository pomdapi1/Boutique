import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { deleteKit, getKit, readKit, saveKit } from "@/lib/kit";

export const runtime = "nodejs";

/** Téléchargement du kit com : tout utilisateur connecté. */
export async function GET() {
  const user = await currentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const kit = await getKit();
  if (!kit) return new NextResponse("Aucun kit disponible", { status: 404 });
  try {
    const file = await readKit(kit);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": kit.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(kit.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Fichier manquant", { status: 410 });
  }
}

/** Même origine obligatoire pour les envois (en plus du cookie SameSite=Lax). */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // navigateurs anciens / même origine sans en-tête
  try {
    // Derrière le proxy Coolify, l'hôte public est dans x-forwarded-host (ou host).
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Dépôt / remplacement (admin). Route plutôt que server action :
 * les server actions sont limitées à 3 Mo, un kit peut peser jusqu'à 50 Mo.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Accès réservé à l'administrateur." }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  try {
    const fd = await req.formData();
    const kit = await saveKit(fd.get("file") as File);
    revalidatePath("/admin/settings");
    revalidatePath("/creator/documents");
    return NextResponse.json({ ok: true, filename: kit.filename });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Envoi impossible." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Accès réservé à l'administrateur." }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  await deleteKit();
  revalidatePath("/admin/settings");
  revalidatePath("/creator/documents");
  return NextResponse.json({ ok: true });
}
