import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { buildProductsWorkbook } from "@/lib/product-import";

export const runtime = "nodejs";

/** Export Excel du catalogue du créateur connecté (sert aussi de modèle d'import). */
export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "CREATOR" || !user.creator) return new NextResponse("Non autorisé", { status: 401 });
  const buf = await buildProductsWorkbook(user.creator.id, user.creator.name);
  const slug = user.creator.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="catalogue-${slug}-${date}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
