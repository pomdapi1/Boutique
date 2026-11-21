import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { buildAdminProductsWorkbook } from "@/lib/product-import-admin";

export const runtime = "nodejs";

/** Export Excel de tout le catalogue de la boutique (admin). */
export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new NextResponse("Non autorisé", { status: 401 });
  const buf = await buildAdminProductsWorkbook();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="catalogue-boutique-${date}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
