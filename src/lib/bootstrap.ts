import { prisma } from "./db";
import { hashPassword } from "./auth-hash";

/**
 * Au démarrage :
 * - s'il n'existe aucun admin, crée le compte ADMIN_EMAIL / ADMIN_PASSWORD ;
 * - si ADMIN_RESET_PASSWORD=true, (re)définit le mot de passe de ADMIN_EMAIL
 *   (crée le compte admin s'il n'existe pas). À retirer après usage.
 */
export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const reset = process.env.ADMIN_RESET_PASSWORD === "true";
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });

  if (!email || !password) {
    if (admins.length === 0) console.warn("[bootstrap] aucun compte admin : définissez ADMIN_EMAIL et ADMIN_PASSWORD puis redéployez.");
    else console.log(`[bootstrap] compte(s) admin existant(s) : ${admins.map((a) => a.email).join(", ")}`);
    return;
  }
  if (password.length < 10) {
    console.error("[bootstrap] ADMIN_PASSWORD trop court (10 caractères minimum) : rien n'a été fait.");
    return;
  }

  if (reset) {
    const hash = await hashPassword(password);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== "ADMIN") {
      console.error(`[bootstrap] ${email} est un compte créateur, pas admin : rien n'a été fait.`);
      return;
    }
    await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash: hash, role: "ADMIN" },
      update: { passwordHash: hash },
    });
    console.log(`[bootstrap] mot de passe admin (ré)initialisé pour ${email}. Retirez ADMIN_RESET_PASSWORD et ADMIN_PASSWORD puis redéployez.`);
    return;
  }

  if (admins.length > 0) {
    console.log(`[bootstrap] compte(s) admin existant(s) : ${admins.map((a) => a.email).join(", ")} — ADMIN_PASSWORD ignoré (utilisez ADMIN_RESET_PASSWORD=true pour le changer).`);
    return;
  }
  await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), role: "ADMIN" } });
  console.log(`[bootstrap] compte administrateur créé : ${email} (vous pouvez retirer ADMIN_PASSWORD des variables).`);
}
