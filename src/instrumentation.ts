/**
 * Démarré une fois au lancement du serveur Next.js (runtime Node).
 * - SUMUP_MODE=live : synchronisation SumUp périodique.
 * - SUMUP_MODE=mock + MOCK_AUTO_SALE_SECONDS>0 : génère des ventes de démonstration.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __conserveScheduler?: boolean };
  if (g.__conserveScheduler) return;
  g.__conserveScheduler = true;

  const { ensureAdmin } = await import("./lib/bootstrap");
  await ensureAdmin().catch((e) => console.error("[bootstrap]", e));

  const mode = process.env.SUMUP_MODE ?? "mock";

  if (mode === "live") {
    const { syncSumUp } = await import("./lib/sumup/sync");
    const interval = Math.max(30, Number(process.env.SUMUP_SYNC_INTERVAL_SECONDS ?? 60) || 60) * 1000;
    const run = async () => {
      const r = await syncSumUp();
      if (!r.ok) console.error("[sumup] synchro en échec :", r.error);
      else if (r.created || r.refunded) console.log(`[sumup] +${r.created} ventes, ${r.refunded} remboursements`);
    };
    setTimeout(run, 5_000);
    setInterval(run, interval);
    console.log(`[sumup] synchro active toutes les ${interval / 1000}s`);
  }

  const mockEvery = Number(process.env.MOCK_AUTO_SALE_SECONDS ?? 0);
  if (mode === "mock" && mockEvery > 0) {
    const { simulateSales } = await import("./lib/sumup/simulate");
    setInterval(() => {
      simulateSales(1).catch((e) => console.error("[mock] ", e));
    }, mockEvery * 1000);
    console.log(`[mock] une vente simulée toutes les ${mockEvery}s`);
  }
}
