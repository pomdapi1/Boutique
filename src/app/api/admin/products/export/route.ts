import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { buildAdminProductsCsv } from "@/lib/product-import-admin";

export const runtime = "nodejs";

/** Export de tout le catalogue au format CSV d'articles SumUp (importable dans la caisse). */
export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new NextResponse("Non autorisé", { status: 401 });
  const csv = await buildAdminProductsCsv();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="catalogue-boutique-sumup-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
