import { prisma } from "../db";
import { ingestTransaction, loadIngestContext } from "../sales";
import { SETTING_KEYS, getSetting, setSetting, sumupConfig } from "../settings";
import { SumUpClient, normalizeSumUpTransaction } from "./client";

export type SyncResult = {
  ok: boolean;
  skipped?: string;
  fetched: number;
  created: number;
  refunded: number;
  error?: string;
};

let running = false;

/**
 * Importe les transactions SumUp créées ou modifiées depuis la dernière synchro.
 * Idempotent : une transaction déjà importée n'est jamais dupliquée.
 */
export async function syncSumUp(): Promise<SyncResult> {
  const cfg = sumupConfig();
  const empty = { fetched: 0, created: 0, refunded: 0 };
  if (cfg.mode !== "live") return { ok: true, skipped: `mode ${cfg.mode}`, ...empty };
  if (!cfg.apiKey || !cfg.merchantCode)
    return { ok: false, error: "SUMUP_API_KEY ou SUMUP_MERCHANT_CODE manquant", ...empty };
  if (running) return { ok: true, skipped: "synchro déjà en cours", ...empty };

  running = true;
  const startedAt = new Date();
  try {
    const last = await getSetting(SETTING_KEYS.sumupLastSyncAt);
    const since = last ? new Date(last) : new Date(Date.now() - cfg.initialDays * 86400_000);
    const client = new SumUpClient(cfg.apiKey, cfg.merchantCode);
    const items = await client.listChangedSince(since);

    const ctx = await loadIngestContext();
    let created = 0;
    let refunded = 0;
    for (const item of items) {
      if (!["SUCCESSFUL", "REFUNDED"].includes(item.status)) continue;
      const known = await prisma.sale.findUnique({ where: { externalId: item.id }, select: { status: true } });
      if (known && (known.status === item.status || item.status === "SUCCESSFUL")) continue;
      if (!known && item.status === "REFUNDED") continue; // remboursée avant import : ignorée

      const detail = known ? item : await client.getTransaction(item.id);
      const normalized = normalizeSumUpTransaction(detail);
      const r = await ingestTransaction(normalized, { source: "SUMUP", context: ctx });
      if (r === "created") created++;
      if (r === "refunded") refunded++;
    }

    // Petite marge de recouvrement pour ne rien rater entre deux appels.
    await setSetting(SETTING_KEYS.sumupLastSyncAt, new Date(startedAt.getTime() - 120_000).toISOString());
    await setSetting(SETTING_KEYS.sumupLastError, null);
    const result = { ok: true, fetched: items.length, created, refunded };
    await setSetting(SETTING_KEYS.sumupLastResult, JSON.stringify(result));
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await setSetting(SETTING_KEYS.sumupLastError, error);
    return { ok: false, error, ...empty };
  } finally {
    await setSetting(SETTING_KEYS.sumupLastRunAt, startedAt.toISOString());
    running = false;
  }
}
