import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

type NotifyInput = {
  kind: string;
  title: string;
  body: string;
  link?: string;
};

type Tx = Prisma.TransactionClient | typeof prisma;

export function notifyCreator(creatorId: string, n: NotifyInput, tx: Tx = prisma) {
  return tx.notification.create({ data: { ...n, creatorId } });
}

export function notifyAllCreators(n: NotifyInput, tx: Tx = prisma) {
  return tx.notification.create({ data: { ...n } });
}

export function notifyAdmins(n: NotifyInput, tx: Tx = prisma) {
  return tx.notification.create({ data: { ...n, forAdmin: true } });
}

/** Notifications visibles par un utilisateur, avec état lu/non lu. */
export async function listNotificationsFor(user: { id: string; role: string; creatorId: string | null }, take = 30) {
  const where: Prisma.NotificationWhereInput =
    user.role === "ADMIN"
      ? { forAdmin: true }
      : { forAdmin: false, OR: [{ creatorId: user.creatorId }, { creatorId: null }] };

  const items = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { reads: { where: { userId: user.id }, select: { userId: true } } },
  });
  return items.map(({ reads, ...n }) => ({ ...n, read: reads.length > 0 }));
}
