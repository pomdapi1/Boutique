import { prisma } from "./db";

/** La référence est-elle déjà utilisée par un autre produit du même créateur ? */
export async function isReferenceTaken(creatorId: string, reference: string, exceptProductId?: string) {
  const other = await prisma.product.findFirst({
    where: { creatorId, reference, ...(exceptProductId ? { NOT: { id: exceptProductId } } : {}) },
    select: { code: true, name: true },
  });
  return other ? `La référence ${reference} est déjà utilisée par « ${other.name} ».` : null;
}

/** Code interne suivant ("024") : sert au nom de l'article dans la caisse SumUp. */
export async function nextProductCode(creatorId: string, offset = 0) {
  const codes = await prisma.product.findMany({ where: { creatorId }, select: { code: true } });
  const max = codes.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0);
  return String(max + 1 + offset).padStart(3, "0");
}
