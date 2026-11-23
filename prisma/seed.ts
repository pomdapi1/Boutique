/**
 * Données de démonstration : `npm run seed` (efface et recrée la base locale).
 * Comptes : admin@boutique.test / admin123 — crochet@boutique.test / demo123
 *           (et <créateur>@boutique.test / demo123 pour les autres).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { canonicalSumupName } from "../src/lib/attribution";
import { ingestTransaction, loadIngestContext, type NormalizedTransaction } from "../src/lib/sales";
import { breakdown } from "../src/lib/money";
import { monthKey, monthRange, shiftMonth } from "../src/lib/dates";

// Générateur pseudo-aléatoire déterministe (mêmes données à chaque seed).
let seed = 42;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]!;

type ProductSeed = [code: string, name: string, euros: number, stock: number];

const CROCHET: ProductSeed[] = [
  ["001", "Porte-clefs Petit", 12, 8],
  ["002", "Porte-clefs Moyen", 15, 6],
  ["003", "Porte-clefs Grand", 20, 1],
  ["004", "Bague", 18, 3],
  ["005", "Boucle d'oreille (petit)", 28, 7],
  ["006", "Boucle d'oreille (grand)", 35, 1],
  ["007", "Collier (petit)", 25, 1],
  ["008", "Collier (grand)", 35, 3],
  ["012", "Pot de fleurs (petit)", 20, 4],
  ["015", "Fleurs en tige (tulipe)", 20, 0],
  ["019", "Fleurs en tige (pivoine)", 20, 5],
  ["021", "Magnet (petit)", 12, 6],
  ["023", "Chien saucisse", 30, 0],
];

const OTHERS: { name: string; slug: string; products: [string, number][] }[] = [
  { name: "Studio Naimé", slug: "naime", products: [["Sticker Et c'est ok", 2], ["Stickers Hello les filles", 2.5], ["Stickers Spritz", 2.5], ["Stickers Hot girls read", 2], ["Stickers Fais toi confiance", 2.5], ["Stickers Tournesol", 2.5], ["Stickers Girls night", 2.5], ["Mini planche stickers - étoiles", 3], ["Carte postale", 3.5], ["Affiche A4", 15]] },
  { name: "Sarradeuxairs", slug: "sarradeuxairs", products: [["Sticker Miso", 2], ["Sticker Male tears", 2.5], ["Sticker fleur", 2.5], ["Worry Stone", 12], ["Badge", 3], ["Tote bag", 18]] },
  { name: "Baldck", slug: "baldck", products: [["Bague réglable", 18], ["Bracelet perles", 22], ["Collier chaîne", 32], ["Boucles créoles", 26]] },
  { name: "Les impatientes", slug: "impatientes", products: [["Monoboucle", 19], ["Boucles fleurs", 24], ["Broche", 16]] },
  { name: "Mr Prout", slug: "mrprout", products: [["Petits bruts", 25], ["Moyen bruts", 35], ["Grand bruts", 48]] },
  { name: "Petit Nuage", slug: "petitnuage", products: [["Y'a couac - Stickers", 2.5], ["Carnet A6", 9], ["Marque-page", 4]] },
  { name: "Scratch", slug: "scratch", products: [["Stickers", 2], ["Sérigraphie", 25], ["Zine", 8]] },
  { name: "Acre Clothes", slug: "acre", products: [["T-shirt brodé", 38], ["Sweat", 62], ["Casquette", 29], ["Chaussettes", 14]] },
  { name: "Atelier Paulette", slug: "paulette", products: [["Bougie", 22], ["Fondant parfumé", 9], ["Diffuseur", 28]] },
  { name: "Green Egg", slug: "greenegg", products: [["Tasse céramique", 24], ["Bol", 28], ["Coupelle", 14]] },
  { name: "Koloro", slug: "koloro", products: [["Print A5", 12], ["Print A4", 20], ["Calendrier", 18]] },
];

// Noms de personnes fictifs pour la démo
const DEMO_OWNERS = ["Léa Bernard", "Hugo Petit", "Chloé Robert", "Lucas Richard", "Manon Durand", "Nathan Moreau", "Inès Simon", "Théo Laurent", "Jade Michel", "Louis Garcia", "Emma Roux"];

async function writeDemoPdf(creatorId: string, label: string) {
  const dir = path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads", creatorId);
  await mkdir(dir, { recursive: true });
  const storedName = `${randomUUID()}.pdf`;
  const content = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n4 0 obj<</Length 60>>stream\nBT /F1 24 Tf 72 760 Td (${label} - document de demo) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`;
  await writeFile(path.join(dir, storedName), content);
  return { storedName, sizeBytes: Buffer.byteLength(content) };
}

async function main() {
  console.log("Nettoyage…");
  await prisma.$transaction([
    prisma.notificationRead.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.saleItem.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.productRequest.deleteMany(),
    prisma.payout.deleteMany(),
    prisma.document.deleteMany(),
    prisma.product.deleteMany(),
    prisma.user.deleteMany(),
    prisma.creator.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  const adminHash = await bcrypt.hash("admin123", 10);
  const demoHash = await bcrypt.hash("demo123", 10);
  await prisma.user.create({ data: { email: "admin@boutique.test", passwordHash: adminHash, role: "ADMIN" } });

  console.log("Créateurs et produits…");
  const crochet = await prisma.creator.create({
    data: {
      name: "Le jardin du crochet",
      ownerName: "Camille Martin",
      contactEmail: "crochet@boutique.test",
      commissionRate: 0.3,
      user: { create: { email: "crochet@boutique.test", passwordHash: demoHash, role: "CREATOR" } },
    },
  });
  for (const [code, name, price, stock] of CROCHET) {
    await prisma.product.create({ data: { creatorId: crochet.id, code, reference: `CRO-${code}`, name, priceCents: price * 100, stock, status: "ACTIVE", category: crochet.name } });
  }

  for (const [i, c] of OTHERS.entries()) {
    const creator = await prisma.creator.create({
      data: {
        name: c.name,
        ownerName: DEMO_OWNERS[i % DEMO_OWNERS.length],
        contactEmail: `${c.slug}@boutique.test`,
        commissionRate: i % 4 === 0 ? 0.25 : 0.3,
        user: { create: { email: `${c.slug}@boutique.test`, passwordHash: demoHash, role: "CREATOR" } },
      },
    });
    for (const [j, [name, price]] of c.products.entries()) {
      await prisma.product.create({
        data: {
          creatorId: creator.id,
          code: String(j + 1).padStart(3, "0"),
          reference: `${c.slug.slice(0, 4).toUpperCase()}-${String(j + 1).padStart(2, "0")}`,
          name,
          priceCents: Math.round(price * 100),
          stock: 5 + Math.floor(rand() * 40),
          status: "ACTIVE",
          category: c.name,
        },
      });
    }
  }

  console.log("Historique des ventes (12 mois)…");
  const products = await prisma.product.findMany({ include: { creator: { select: { name: true } } } });
  const ctx = await loadIngestContext();
  const now = new Date();
  let n = 0;

  const makeTx = (at: Date): NormalizedTransaction => {
    const count = rand() < 0.6 ? 1 : rand() < 0.8 ? 2 : 3;
    const lines = Array.from({ length: count }, () => {
      const p = pick(products);
      const q = rand() < 0.85 ? 1 : 2;
      return {
        name: canonicalSumupName({ code: p.code, name: p.name, creatorName: p.creator.name }),
        quantity: q,
        unitPriceCents: p.priceCents,
        totalCents: p.priceCents * q,
      };
    });
    const total = lines.reduce((a, l) => a + l.totalCents, 0);
    return {
      externalId: `SEED-${at.getTime()}-${n++}`,
      occurredAt: at,
      totalCents: total,
      feeCents: null,
      paymentType: rand() < 0.88 ? "CARD" : "CASH",
      status: "SUCCESSFUL",
      lines,
    };
  };

  for (let d = 365; d >= 0; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
    if (day.getDay() === 1) continue; // fermé le lundi
    const growth = 0.4 + (1 - d / 365) * 0.9;
    const salesToday = Math.round(rand() * 6 * growth) + (d === 0 ? 6 : 0);
    for (let s = 0; s < salesToday; s++) {
      const at = new Date(day);
      at.setHours(11 + Math.floor(rand() * 8), Math.floor(rand() * 60));
      if (at > now) at.setTime(now.getTime() - (s + 1) * 7 * 60_000);
      await ingestTransaction(makeTx(at), { source: "SIMULATION", affectStock: false, context: ctx });
    }
  }

  // Une ligne non reconnue (nom SumUp mal saisi) pour la démo admin.
  await ingestTransaction(
    {
      externalId: `SEED-unmatched-${now.getTime()}`,
      occurredAt: new Date(now.getTime() - 3 * 3600_000),
      totalCents: 1500,
      feeCents: null,
      paymentType: "CARD",
      status: "SUCCESSFUL",
      lines: [{ name: "Porte clef moyen crochet", quantity: 1, unitPriceCents: 1500, totalCents: 1500 }],
    },
    { source: "SIMULATION", affectStock: false, context: ctx },
  );

  console.log("Clôtures passées…");
  const current = monthKey(now);
  for (let k = 12; k >= 2; k--) {
    const m = shiftMonth(current, -k);
    const { start, end } = monthRange(m);
    const items = await prisma.saleItem.findMany({
      where: { creatorId: { not: null }, sale: { occurredAt: { gte: start, lt: end } } },
    });
    const byCreator = new Map<string, typeof items>();
    for (const it of items) byCreator.set(it.creatorId!, [...(byCreator.get(it.creatorId!) ?? []), it]);
    for (const [creatorId, list] of byCreator) {
      const b = breakdown(list);
      await prisma.payout.create({
        data: {
          creatorId,
          month: m,
          grossCents: b.grossCents,
          feeCents: b.feeCents,
          commissionCents: b.commissionCents,
          netCents: b.netCents,
          closedAt: monthRange(shiftMonth(m, 1)).start,
          paidAt: new Date(monthRange(shiftMonth(m, 1)).start.getTime() + 8 * 86400_000),
        },
      });
    }
  }

  console.log("Demandes, documents, notifications…");
  await prisma.product.create({
    data: { creatorId: crochet.id, code: "024", reference: "CRO-LYS", name: "Fleurs en tige (lys)", priceCents: 2200, stock: 4, status: "PENDING", category: crochet.name },
  });
  const pivoine = await prisma.product.findFirstOrThrow({ where: { creatorId: crochet.id, code: "019" } });
  await prisma.productRequest.create({
    data: { productId: pivoine.id, creatorId: crochet.id, changes: JSON.stringify({ priceCents: 2200 }) },
  });

  for (const [type, filename] of [
    ["RIB", "rib_boursobank-NEW.pdf"],
    ["RC_PRO", "PNC-300241_attestation.pdf"],
    ["KBIS", "kbis_951839968.pdf"],
  ] as const) {
    const f = await writeDemoPdf(crochet.id, filename);
    await prisma.document.create({ data: { creatorId: crochet.id, type, filename, mimeType: "application/pdf", ...f } });
  }

  const days = (x: number) => new Date(now.getTime() - x * 86400_000);
  await prisma.notification.createMany({
    data: [
      { kind: "PRODUCT", title: "Changements du " + days(5).toLocaleDateString("fr-FR").slice(0, 5), body: "Vous pouvez maintenant enlever du stock : cliquez pour découvrir ce qui change.", link: "/creator/products", createdAt: days(5) },
      { kind: "CLOSING", title: `Clôture du mois précédent`, body: "Votre relevé de ventes du mois est disponible : téléchargez-le en PDF depuis « Mes ventes ».", link: `/creator/sales?m=${shiftMonth(current, -1)}`, createdAt: days(7) },
      { kind: "STOCK_OUT", creatorId: crochet.id, title: "1 nouveau produit en rupture de stock", body: "023 - Chien saucisse - Le jardin du crochet", link: "/creator/products?tab=rupture", createdAt: days(24) },
      { kind: "INFO", title: "Donnez-nous votre avis sur l'app", body: "Vos retours nous aident à améliorer votre espace. Quelques minutes suffisent pour répondre.", createdAt: days(30) },
      { kind: "PRODUCT", forAdmin: true, title: "Nouveau produit à valider", body: "024 - Fleurs en tige (lys) — Le jardin du crochet", link: "/admin/products", createdAt: days(1) },
    ],
  });

  const [sales, items] = await Promise.all([prisma.sale.count(), prisma.saleItem.count()]);
  console.log(`OK — ${OTHERS.length + 1} créateurs, ${products.length} produits, ${sales} ventes, ${items} lignes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
