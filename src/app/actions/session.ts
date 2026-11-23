"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authenticate, checkPassword, createSession, currentUser, destroySession, hashPassword } from "@/lib/auth";
import { homeFor } from "@/lib/session";
import { listNotificationsFor } from "@/lib/notifications";
import { clientIp, loginBlockedFor, recordLoginFailure, recordLoginSuccess } from "@/lib/rate-limit";
import { PASSWORD_MIN } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/components/action-form";

function waitLabel(seconds: number) {
  const min = Math.ceil(seconds / 60);
  return min <= 1 ? "1 minute" : `${min} minutes`;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Email et mot de passe requis." };

  const ip = clientIp(await headers());
  const blocked = loginBlockedFor(email, ip);
  if (blocked > 0) return { error: `Trop de tentatives échouées. Réessayez dans ${waitLabel(blocked)}.` };

  const user = await authenticate(email, password);
  if (!user) {
    recordLoginFailure(email, ip);
    return { error: "Identifiants incorrects." };
  }
  recordLoginSuccess(email);
  await createSession(user);
  redirect(homeFor(user.role));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/** Changement de son propre mot de passe : révoque les autres sessions, garde celle-ci. */
export async function changePasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) redirect("/logout");
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const ip = clientIp(await headers());
  const blocked = loginBlockedFor(user.email, ip);
  if (blocked > 0) return { error: `Trop de tentatives échouées. Réessayez dans ${waitLabel(blocked)}.` };
  if (!(await checkPassword(user, current))) {
    recordLoginFailure(user.email, ip);
    return { error: "Mot de passe actuel incorrect." };
  }
  if (next.length < PASSWORD_MIN) return { error: `Nouveau mot de passe : ${PASSWORD_MIN} caractères minimum.` };
  if (next.length > 200) return { error: "Nouveau mot de passe trop long." };
  if (next !== confirm) return { error: "La confirmation ne correspond pas au nouveau mot de passe." };
  if (next === current) return { error: "Le nouveau mot de passe doit être différent de l'actuel." };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
  await createSession(updated);
  return { ok: true, message: "Mot de passe modifié. Vos autres appareils ont été déconnectés." };
}

export async function markNotificationsReadAction() {
  const user = await currentUser();
  if (!user) return;
  const list = await listNotificationsFor(user, 50);
  const unread = list.filter((n) => !n.read);
  if (unread.length === 0) return;
  await prisma.notificationRead.createMany({
    data: unread.map((n) => ({ userId: user.id, notificationId: n.id })),
  });
  revalidatePath("/", "layout");
}
