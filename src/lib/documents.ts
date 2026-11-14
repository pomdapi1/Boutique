import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "./constants";

function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
}

const EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

/** Vérifie la signature binaire du fichier (on ne fait pas confiance au type MIME déclaré). */
function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString("ascii") === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  return null;
}

export class DocumentError extends Error {}

export async function saveDocument(opts: {
  creatorId: string;
  type: string;
  file: File;
  replaceId?: string | null;
}) {
  const cfg = DOCUMENT_TYPES.find((t) => t.type === opts.type);
  if (!cfg) throw new DocumentError("Type de document inconnu.");
  if (!opts.file || opts.file.size === 0) throw new DocumentError("Aucun fichier sélectionné.");
  if (opts.file.size > MAX_DOCUMENT_BYTES) throw new DocumentError("Fichier trop volumineux (2 Mo maximum).");

  const buf = Buffer.from(await opts.file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !cfg.mimeTypes.includes(mime))
    throw new DocumentError(cfg.mimeTypes.length > 1 ? "Format accepté : PDF ou image." : "Format accepté : PDF.");

  let replaced: { id: string; storedName: string } | null = null;
  if (opts.replaceId) {
    replaced = await prisma.document.findFirst({
      where: { id: opts.replaceId, creatorId: opts.creatorId, type: opts.type },
      select: { id: true, storedName: true },
    });
    if (!replaced) throw new DocumentError("Document à remplacer introuvable.");
  } else {
    const count = await prisma.document.count({ where: { creatorId: opts.creatorId, type: opts.type } });
    if (count >= cfg.max)
      throw new DocumentError(`${cfg.max} document(s) maximum pour « ${cfg.label} ». Remplacez ou supprimez-en un.`);
  }

  const dir = path.join(uploadDir(), opts.creatorId);
  await mkdir(dir, { recursive: true });
  const storedName = `${randomUUID()}${EXT[mime]}`;
  await writeFile(path.join(dir, storedName), buf);

  const filename = path.basename(opts.file.name).slice(0, 180) || `document${EXT[mime]}`;
  const data = { filename, storedName, sizeBytes: buf.length, mimeType: mime, createdAt: new Date() };

  if (replaced) {
    await prisma.document.update({ where: { id: replaced.id }, data });
    await unlink(path.join(dir, replaced.storedName)).catch(() => {});
  } else {
    await prisma.document.create({ data: { ...data, creatorId: opts.creatorId, type: opts.type } });
  }
}

/** Supprime le dossier de documents d'un créateur (après suppression du créateur en base). */
export async function deleteCreatorFiles(creatorId: string) {
  // creatorId est un cuid généré par la base : on vérifie tout de même qu'il ne sort pas du dossier.
  if (!/^[a-z0-9]+$/i.test(creatorId)) return;
  await rm(path.join(uploadDir(), creatorId), { recursive: true, force: true });
}

export async function deleteDocument(id: string, creatorId: string) {
  const doc = await prisma.document.findFirst({ where: { id, creatorId } });
  if (!doc) return;
  await prisma.document.delete({ where: { id } });
  await unlink(path.join(uploadDir(), creatorId, doc.storedName)).catch(() => {});
}

export async function readDocumentFile(doc: { creatorId: string; storedName: string }) {
  // storedName est généré par le serveur (uuid + extension) : pas de traversée de chemin possible.
  return readFile(path.join(uploadDir(), doc.creatorId, path.basename(doc.storedName)));
}

export function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
