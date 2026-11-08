"use server";

import { currentUser } from "@/lib/auth";
import { grossByCreator } from "@/lib/stats";
import { parseMonthKey } from "@/lib/dates";

export async function grossByCreatorAction(month: string) {
  const user = await currentUser();
  if (!user) throw new Error("Non authentifié");
  return grossByCreator(parseMonthKey(month));
}
