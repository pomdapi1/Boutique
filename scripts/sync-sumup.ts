/**
 * Lance une synchronisation SumUp ponctuelle (SUMUP_MODE=live requis).
 *   npm run sumup:sync
 */
import { prisma } from "../src/lib/db";
import { syncSumUp } from "../src/lib/sumup/sync";

syncSumUp()
  .then((r) => {
    console.log(r);
    if (!r.ok) process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
