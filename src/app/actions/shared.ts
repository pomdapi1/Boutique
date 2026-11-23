"use server";

import { currentUser } from "@/lib/auth";
import { grossByCreator } from "@/lib/stats";
import { parseMonthKey } from "@/lib/dates";

/** CA brut par créateur (bouton « CA global ») : réservé à l'admin, les créateurs ne voient que leurs chiffres. */
export async function grossByCreatorAction(month: string) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") throw new Error("Accès réservé à l'administrateur.");
  return grossByCreator(parseMonthKey(month));
}
