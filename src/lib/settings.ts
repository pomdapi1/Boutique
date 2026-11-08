import { prisma } from "./db";
import { DEFAULT_CARD_FEE_RATE, DEFAULT_COMMISSION_RATE } from "./constants";

export const SETTING_KEYS = {
  defaultCommissionRate: "defaultCommissionRate",
  cardFeeRate: "cardFeeRate",
  sumupLastSyncAt: "sumup.lastSyncAt",
  sumupLastRunAt: "sumup.lastRunAt",
  sumupLastError: "sumup.lastError",
  sumupLastResult: "sumup.lastResult",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await prisma.setting.deleteMany({ where: { key } });
    return;
  }
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

async function getNumber(key: string, fallback: number): Promise<number> {
  const v = await getSetting(key);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const getDefaultCommissionRate = () =>
  getNumber(SETTING_KEYS.defaultCommissionRate, DEFAULT_COMMISSION_RATE);

export const getCardFeeRate = () => getNumber(SETTING_KEYS.cardFeeRate, DEFAULT_CARD_FEE_RATE);

export function sumupConfig() {
  return {
    mode: (process.env.SUMUP_MODE ?? "mock") as "mock" | "live" | "off",
    apiKey: process.env.SUMUP_API_KEY ?? "",
    merchantCode: process.env.SUMUP_MERCHANT_CODE ?? "",
    intervalSeconds: Number(process.env.SUMUP_SYNC_INTERVAL_SECONDS ?? 60) || 60,
    initialDays: Number(process.env.SUMUP_INITIAL_DAYS ?? 30) || 30,
  };
}
