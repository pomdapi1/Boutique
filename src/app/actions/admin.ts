"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseEurosToCents } from "@/lib/money";
import { notifyAllCreators, notifyCreator } from "@/lib/notifications";
import { SETTING_KEYS, getDefaultCommissionRate, setSetting, sumupConfig } from "@/lib/settings";
import { assignSaleItem } from "@/lib/sales";
import { computePayouts } from "@/lib/stats";
import { monthLabel, parseMonthKey } from "@/lib/dates";
import { syncSumUp } from "@/lib/sumup/sync";
import { simulateSales } from "@/lib/sumup/simulate";
import { SumUpClient } from "@/lib/sumup/client";
import { productLabel } from "@/lib/utils";
import type { ActionState } from "@/components/action-form";

function fail(e: z.ZodError): ActionState {
  return { error: e.issues[0]!.message };
}

const pct = z.coerce.number().min(0, "Taux invalide").max(100, "Taux invalide");

// ---------- Créateurs ----------

export async function createCreatorAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Nom trop court").max(80),
      email: z.string().trim().toLowerCase().email("Email invalide"),
      password: z.string().min(8, "Mot de passe : 8 caractères minimum"),
      commission: z.union([z.literal(""), pct]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  if (await prisma.user.findUnique({ where: { email: d.email } })) return { error: "Cet email est déjà utilisé." };
  if (await prisma.creator.findUnique({ where: { name: d.name } })) return { error: "Ce nom de créateur existe déjà." };

  const rate = d.commission === "" || d.commission === undefined ? await getDefaultCommissionRate() : Number(d.commission) / 100;
  await prisma.creator.create({
    data: {
      name: d.name,
      contactEmail: d.email,
      commissionRate: rate,
      user: { create: { email: d.email, passwordHash: await hashPassword(d.password), role: "CREATOR" } },
    },
  });
  revalidatePath("/admin/creators");
  return { ok: true, message: `Compte créé pour ${d.name}. Transmettez-lui ses identifiants.` };
}

export async function updateCreatorAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string(),
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email("Email invalide"),
      commission: pct,
      active: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const creator = await prisma.creator.findUnique({ where: { id: d.id }, include: { user: true } });
  if (!creator) return { error: "Créateur introuvable." };
  const clash = await prisma.user.findFirst({ where: { email: d.email, NOT: { creatorId: d.id } } });
  if (clash) return { error: "Cet email est déjà utilisé." };

  await prisma.creator.update({
    where: { id: d.id },
    data: {
      name: d.name,
      contactEmail: d.email,
      commissionRate: d.commission / 100,
      active: d.active === "on",
      ...(creator.user ? { user: { update: { email: d.email } } } : {}),
    },
  });
  revalidatePath("/admin/creators");
  return { ok: true, message: "Modifications enregistrées. Le nouveau taux s'applique aux prochaines ventes." };
}

export async function resetPasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "8 caractères minimum." };
  const r = await prisma.user.updateMany({
    where: { creatorId: String(fd.get("creatorId")) },
    data: { passwordHash: await hashPassword(password) },
  });
  if (r.count === 0) return { error: "Compte introuvable." };
  return { ok: true, message: "Mot de passe mis à jour." };
}

// ---------- Produits ----------

export async function approveProductAction(fd: FormData) {
  await requireAdmin();
  const product = await prisma.product.update({
    where: { id: String(fd.get("id")) },
    data: { status: "ACTIVE", sumupName: (fd.get("sumupName") as string)?.trim() || undefined },
  });
  await notifyCreator(product.creatorId, {
    kind: "REQUEST",
    title: "Produit validé par Conserve",
    body: productLabel(product),
    link: "/creator/products",
  });
  revalidatePath("/admin/products");
}

export async function rejectProductAction(fd: FormData) {
  await requireAdmin();
  const note = String(fd.get("note") ?? "").trim();
  const product = await prisma.product.update({ where: { id: String(fd.get("id")) }, data: { status: "REJECTED" } });
  await notifyCreator(product.creatorId, {
    kind: "REQUEST",
    title: "Produit refusé",
    body: `${productLabel(product)}${note ? `\n${note}` : ""}`,
    link: "/creator/products",
  });
  revalidatePath("/admin/products");
}

export async function decideRequestAction(fd: FormData) {
  await requireAdmin();
  const approve = fd.get("decision") === "approve";
  const req = await prisma.productRequest.findUnique({ where: { id: String(fd.get("id")) }, include: { product: true } });
  if (!req || req.status !== "PENDING") return;
  const changes = JSON.parse(req.changes) as { name?: string; priceCents?: number; category?: string };

  await prisma.$transaction([
    prisma.productRequest.update({
      where: { id: req.id },
      data: { status: approve ? "APPROVED" : "REJECTED", decidedAt: new Date(), adminNote: String(fd.get("note") ?? "") || null },
    }),
    ...(approve ? [prisma.product.update({ where: { id: req.productId }, data: changes })] : []),
  ]);
  await notifyCreator(req.creatorId, {
    kind: "REQUEST",
    title: approve ? "Modification validée par Conserve" : "Modification refusée",
    body: `Modification · ${productLabel(req.product)}`,
    link: "/creator/products",
  });
  revalidatePath("/admin/products");
}

export async function adminUpdateProductAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id: String(fd.get("id")) } });
  if (!product) return { error: "Produit introuvable." };
  const priceCents = parseEurosToCents(String(fd.get("price") ?? ""));
  if (priceCents === null || priceCents <= 0) return { error: "Prix invalide." };
  const stock = z.coerce.number().int().min(0).safeParse(fd.get("stock"));
  if (!stock.success) return { error: "Stock invalide." };
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Nom trop court." };
  const status = String(fd.get("status"));
  if (!["PENDING", "ACTIVE", "REJECTED", "ARCHIVED"].includes(status)) return { error: "Statut invalide." };

  await prisma.$transaction([
    prisma.product.update({
      where: { id: product.id },
      data: {
        name,
        priceCents,
        stock: stock.data,
        status,
        category: String(fd.get("category") ?? "").trim() || null,
        sumupName: String(fd.get("sumupName") ?? "").trim() || null,
      },
    }),
    ...(stock.data !== product.stock
      ? [
          prisma.stockMovement.create({
            data: { productId: product.id, delta: stock.data - product.stock, reason: "CORRECTION", userId: admin.id, note: "Correction admin" },
          }),
        ]
      : []),
  ]);
  revalidatePath("/admin/products");
  return { ok: true, message: "Produit mis à jour." };
}

// ---------- Ventes ----------

export async function assignSaleItemAction(fd: FormData) {
  const admin = await requireAdmin();
  const productId = String(fd.get("productId") ?? "");
  if (!productId) return;
  await assignSaleItem(String(fd.get("itemId")), productId, admin.id);
  revalidatePath("/admin/sales");
}

// ---------- Reversements ----------

export async function closeMonthAction(fd: FormData) {
  await requireAdmin();
  const month = parseMonthKey(String(fd.get("month")));
  const rows = await computePayouts(month);
  for (const r of rows) {
    if (r.payout || r.computed.grossCents === 0) continue;
    await prisma.payout.create({
      data: {
        creatorId: r.creator.id,
        month,
        grossCents: r.computed.grossCents,
        feeCents: r.computed.feeCents,
        commissionCents: r.computed.commissionCents,
        netCents: r.computed.netCents,
      },
    });
    await notifyCreator(r.creator.id, {
      kind: "CLOSING",
      title: `Clôture de ${monthLabel(month)}`,
      body: "Téléchargez votre relevé de ventes en PDF et déposez votre facture mensuelle.",
      link: `/creator/sales?m=${month}`,
    });
  }
  revalidatePath("/admin/payouts");
}

export async function reopenPayoutAction(fd: FormData) {
  await requireAdmin();
  await prisma.payout.deleteMany({ where: { id: String(fd.get("id")), paidAt: null } });
  revalidatePath("/admin/payouts");
}

export async function togglePayoutPaidAction(fd: FormData) {
  await requireAdmin();
  const p = await prisma.payout.findUnique({ where: { id: String(fd.get("id")) } });
  if (!p) return;
  await prisma.payout.update({ where: { id: p.id }, data: { paidAt: p.paidAt ? null : new Date() } });
  revalidatePath("/admin/payouts");
}

// ---------- Notifications ----------

export async function sendNotificationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const target = String(fd.get("target") ?? "all");
  const link = String(fd.get("link") ?? "").trim();
  if (title.length < 2 || body.length < 2) return { error: "Titre et message requis." };
  if (link && !link.startsWith("/") && !/^https:\/\//.test(link)) return { error: "Lien : chemin interne (/creator/...) ou URL https." };
  const n = { kind: "INFO", title, body, link: link || undefined };
  if (target === "all") await notifyAllCreators(n);
  else await notifyCreator(target, n);
  revalidatePath("/admin/notifications");
  return { ok: true, message: "Notification envoyée." };
}

export async function deleteNotificationAction(fd: FormData) {
  await requireAdmin();
  await prisma.notification.deleteMany({ where: { id: String(fd.get("id")) } });
  revalidatePath("/admin/notifications");
}

// ---------- Paramètres & SumUp ----------

export async function updateSettingsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({ defaultCommission: pct, cardFeeRate: z.coerce.number().min(0).max(10) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error);
  await setSetting(SETTING_KEYS.defaultCommissionRate, String(parsed.data.defaultCommission / 100));
  await setSetting(SETTING_KEYS.cardFeeRate, String(parsed.data.cardFeeRate / 100));
  if (fd.get("applyAll") === "on") {
    await prisma.creator.updateMany({ data: { commissionRate: parsed.data.defaultCommission / 100 } });
  }
  revalidatePath("/admin/settings");
  return { ok: true, message: "Paramètres enregistrés." };
}

export async function syncNowAction(_p: ActionState): Promise<ActionState> {
  await requireAdmin();
  if (sumupConfig().mode === "mock") {
    const n = await simulateSales(1);
    revalidatePath("/admin", "layout");
    return { ok: true, message: n ? "Mode mock : 1 vente simulée ajoutée." : "Mode mock : aucun produit actif en stock." };
  }
  const r = await syncSumUp();
  revalidatePath("/admin", "layout");
  if (!r.ok) return { error: r.error ?? "Erreur inconnue" };
  if (r.skipped) return { ok: true, message: `Synchro ignorée : ${r.skipped}.` };
  return { ok: true, message: `${r.fetched} transaction(s) lue(s), ${r.created} vente(s) importée(s), ${r.refunded} remboursement(s).` };
}

export async function testSumUpAction(_p: ActionState): Promise<ActionState> {
  await requireAdmin();
  const cfg = sumupConfig();
  if (!cfg.apiKey) return { error: "SUMUP_API_KEY n'est pas défini dans l'environnement." };
  try {
    const me = await new SumUpClient(cfg.apiKey, cfg.merchantCode).me();
    const code = me.merchant_profile?.merchant_code;
    const name = me.merchant_profile?.company_name ?? "";
    if (cfg.merchantCode && code && code !== cfg.merchantCode)
      return { error: `Clé valide pour le marchand ${code}, mais SUMUP_MERCHANT_CODE vaut ${cfg.merchantCode}.` };
    return { ok: true, message: `Connexion OK — marchand ${code ?? "?"} ${name}`.trim() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
