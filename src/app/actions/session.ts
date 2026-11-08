"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authenticate, createSession, currentUser, destroySession } from "@/lib/auth";
import { homeFor } from "@/lib/session";
import { listNotificationsFor } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/components/action-form";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email et mot de passe requis." };
  const user = await authenticate(email, password);
  if (!user) return { error: "Identifiants incorrects." };
  await createSession(user);
  redirect(homeFor(user.role));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
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
