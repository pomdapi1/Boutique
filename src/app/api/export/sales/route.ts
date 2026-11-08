import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseMonthKey } from "@/lib/dates";
import { breakdown } from "@/lib/money";
import { loadCreatorSales, parseSalesFilters } from "@/lib/creator-sales";
import { renderStatement } from "@/lib/pdf/statement";

export const runtime = "nodejs";

/** Relevé PDF. Créateur : ses ventes. Admin : ?creator=<id> obligatoire. */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const creatorId = user.role === "ADMIN" ? sp.creator : user.creatorId;
  if (!creatorId) return new NextResponse("Créateur manquant", { status: 400 });
  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) return new NextResponse("Introuvable", { status: 404 });

  const month = parseMonthKey(sp.m);
  const filters = { ...parseSalesFilters(sp, month), sort: "oldest" as const };
  const items = await loadCreatorSales(creator.id, filters);

  const pdf = await renderStatement({
    creatorName: creator.name,
    month,
    commissionRate: creator.commissionRate,
    breakdown: breakdown(items),
    items: items.map((i) => ({
      occurredAt: i.sale.occurredAt,
      label: i.product ? `${i.product.code} - ${i.product.name}` : i.label,
      quantity: i.quantity,
      paymentType: i.sale.paymentType,
      totalCents: i.totalCents,
    })),
  });

  const filename = `releve-${creator.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${month}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
