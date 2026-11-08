import { prisma } from "./db";
import { hashPassword } from "./auth-hash";

/**
 * Au premier démarrage en production : crée le compte administrateur
 * à partir de ADMIN_EMAIL / ADMIN_PASSWORD s'il n'existe encore aucun admin.
 */
export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const count = await prisma.user.count({ where: { role: "ADMIN" } });
  if (count > 0) return;
  if (password.length < 10) {
    console.error("[bootstrap] ADMIN_PASSWORD trop court (10 caractères minimum) : admin non créé.");
    return;
  }
  await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), role: "ADMIN" } });
  console.log(`[bootstrap] compte administrateur créé : ${email} (vous pouvez retirer ADMIN_PASSWORD des variables).`);
}
