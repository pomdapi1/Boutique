import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";

export { hashPassword } from "./auth-hash";

export async function createSession(user: { id: string; role: string; creatorId: string | null }) {
  const token = await signSession({
    uid: user.id,
    role: user.role as "ADMIN" | "CREATOR",
    cid: user.creatorId,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

let dummyHash: string | undefined;

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { creator: true },
  });
  // Comparaison effectuée même si l'utilisateur n'existe pas (temps constant).
  dummyHash ??= await bcrypt.hash("conserve-dummy", 10);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok) return null;
  if (user.creator && !user.creator.active) return null;
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

/** Utilisateur courant (relu en base à chaque requête : un compte désactivé perd l'accès). */
export async function currentUser() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid }, include: { creator: true } });
  if (!user || (user.creator && !user.creator.active)) return null;
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/creator/boutique");
  return user;
}

export async function requireCreator() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "CREATOR" || !user.creator) redirect("/admin");
  return { user, creator: user.creator };
}
