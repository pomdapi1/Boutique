import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { buildCreatorProductsCsv } from "@/lib/product-import";

export const runtime = "nodejs";

/** Export du catalogue du créateur connecté au format CSV d'articles SumUp (sert aussi de modèle d'import). */
export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "CREATOR" || !user.creator) return new NextResponse("Non autorisé", { status: 401 });
  const csv = await buildCreatorProductsCsv(user.creator.id, user.creator.name);
  const slug = user.creator.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="catalogue-${slug}-sumup-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
