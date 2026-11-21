/**
 * Kit de communication (logos, icônes, posts) déposé par l'admin et
 * téléchargeable par tous les créateurs. Un seul fichier à la fois.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSetting, setSetting } from "./settings";

export const KIT_MAX_BYTES = 50 * 1024 * 1024;
const KIT_SETTING = "kit.file";

export type KitInfo = { storedName: string; filename: string; sizeBytes: number; mimeType: string; uploadedAt: string };

function kitDir() {
  return path.join(path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads"), "_kit");
}

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "application/zip", ext: ".zip", test: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 },
  { mime: "application/pdf", ext: ".pdf", test: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
  { mime: "image/png", ext: ".png", test: (b) => b[0] === 0x89 && b.subarray(1, 4).toString("ascii") === "PNG" },
  { mime: "image/jpeg", ext: ".jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

export async function getKit(): Promise<KitInfo | null> {
  const raw = await getSetting(KIT_SETTING);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KitInfo;
  } catch {
    return null;
  }
}

export async function saveKit(file: File): Promise<KitInfo> {
  if (!file || file.size === 0) throw new Error("Aucun fichier sélectionné.");
  if (file.size > KIT_MAX_BYTES) throw new Error("Fichier trop volumineux (50 Mo maximum).");
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) throw new Error("Format accepté : ZIP, PDF, PNG ou JPEG.");

  await mkdir(kitDir(), { recursive: true });
  const storedName = `${randomUUID()}${sig.ext}`;
  await writeFile(path.join(kitDir(), storedName), buf);

  const previous = await getKit();
  const info: KitInfo = {
    storedName,
    filename: path.basename(file.name).slice(0, 180) || `kit${sig.ext}`,
    sizeBytes: buf.length,
    mimeType: sig.mime,
    uploadedAt: new Date().toISOString(),
  };
  await setSetting(KIT_SETTING, JSON.stringify(info));
  if (previous) await unlink(path.join(kitDir(), path.basename(previous.storedName))).catch(() => {});
  return info;
}

export async function deleteKit() {
  const previous = await getKit();
  await setSetting(KIT_SETTING, null);
  if (previous) await unlink(path.join(kitDir(), path.basename(previous.storedName))).catch(() => {});
}

export async function readKit(kit: KitInfo) {
  return readFile(path.join(kitDir(), path.basename(kit.storedName)));
}
