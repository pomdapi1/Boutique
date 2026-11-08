/**
 * Injecte des ventes simulées (même chemin de code que l'import SumUp :
 * attribution, frais, commission, décrément du stock, notification de rupture).
 *   npm run sumup:simulate          → 1 vente
 *   npm run sumup:simulate -- 5     → 5 ventes
 */
import { prisma } from "../src/lib/db";
import { simulateSales } from "../src/lib/sumup/simulate";

const count = Math.max(1, Number(process.argv[2] ?? 1) || 1);

simulateSales(count)
  .then((n) => console.log(`${n} vente(s) simulée(s) ajoutée(s).`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
