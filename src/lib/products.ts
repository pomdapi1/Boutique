import { prisma } from "./db";

/** La référence est-elle déjà utilisée par un autre produit du même créateur ? */
export async function isReferenceTaken(creatorId: string, reference: string, exceptProductId?: string) {
  const other = await prisma.product.findFirst({
    where: { creatorId, reference, ...(exceptProductId ? { NOT: { id: exceptProductId } } : {}) },
    select: { code: true, name: true },
  });
  return other ? `La référence ${reference} est déjà utilisée par « ${other.code} - ${other.name} ».` : null;
}
