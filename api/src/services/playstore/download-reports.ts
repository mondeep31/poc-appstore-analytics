import path from "node:path";
import { mkdir, open, readdir, stat, writeFile } from "node:fs/promises";

import { PLAYSTORE_REPORT_PREFIXES } from "./constants.ts";
import { downloadBlobToFile, listReportBlobs, storageFromEnv } from "./gcs.ts";
import {
  entryUnchanged,
  loadManifest,
  saveManifest,
  type ManifestEntry,
  type ManifestFile,
} from "./manifest.ts";
import { peekFirstLine } from "./text-decode.ts";

const LOG = "[playstore-download]";
const IGNORE_NAMES = new Set(["manifest.json", "inventory.json"]);

function rawDir(): string {
  return (
    process.env.PLAYSTORE_RAW_DIR?.trim() ||
    path.join(process.cwd(), "data", "playstore", "raw")
  );
}

function bucketName(): string {
  const b = process.env.PLAYSTORE_GCS_BUCKET?.trim();
  if (!b) {
    throw new Error("PLAYSTORE_GCS_BUCKET is required (bucket id without gs://)");
  }
  return b.replace(/^gs:\/\//, "");
}

function packageName(): string | undefined {
  const p = process.env.PLAYSTORE_PACKAGE_NAME?.trim();
  return p || undefined;
}

function objectToLocalFile(base: string, objectName: string): string {
  const parts = objectName.split("/").filter(Boolean);
  return path.join(base, ...parts);
}

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function collectRelativeFiles(dir: string, baseLen: number): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = full.slice(baseLen).replace(/^[/\\]/, "");
    if (ent.isDirectory()) {
      out.push(...(await collectRelativeFiles(full, baseLen)));
    } else if (!IGNORE_NAMES.has(ent.name)) {
      out.push(rel.split(path.sep).join("/"));
    }
  }
  return out;
}

export interface InventoryRow {
  relativePath: string;
  sizeBytes: number;
  /** Best-effort first line (CSV header for UTF-16/UTF-8 text) */
  firstLine: string;
  textEncoding: string;
}

async function buildInventory(rawBase: string): Promise<InventoryRow[]> {
  const baseLen = rawBase.length;
  const rels = await collectRelativeFiles(rawBase, baseLen);
  const rows: InventoryRow[] = [];

  for (const rel of rels.sort()) {
    const abs = path.join(rawBase, ...rel.split("/"));
    const st = await stat(abs);
    if (!st.isFile()) continue;

    let firstLine = "";
    let textEncoding = "skipped";
    try {
      const fd = await open(abs, "r");
      try {
        const buf = Buffer.alloc(Math.min(st.size, 256 * 1024));
        const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
        const peek = peekFirstLine(buf.subarray(0, bytesRead));
        firstLine = peek.line;
        textEncoding = peek.encoding;
      } finally {
        await fd.close();
      }
    } catch {
      textEncoding = "error";
    }

    rows.push({
      relativePath: rel,
      sizeBytes: st.size,
      firstLine,
      textEncoding,
    });
  }

  return rows;
}

/**
 * Lists Play bulk-report objects in GCS, downloads new/changed blobs, updates manifest + inventory.
 * Triggered by the in-process scheduler ([playstore-scheduler.ts](../../playstore-scheduler.ts)) when enabled.
 */
export async function runPlaystoreReportDownload(): Promise<void> {
  const base = rawDir();
  const bucket = bucketName();
  const pkg = packageName();

  if (!pkg) {
    console.warn(
      `${LOG} PLAYSTORE_PACKAGE_NAME is unset — downloading all objects matching prefixes (may include other apps).`,
    );
  }

  await mkdir(base, { recursive: true });

  const manifestPath = path.join(base, "manifest.json");
  const inventoryPath = path.join(base, "inventory.json");

  const storage = storageFromEnv();
  console.log(`${LOG} Listing gs://${bucket}/ …`);
  const blobs = await listReportBlobs(storage, bucket, {
    prefixes: PLAYSTORE_REPORT_PREFIXES,
    packageName: pkg,
  });

  console.log(`${LOG} ${blobs.length} object(s) after package filter`);

  const manifest: ManifestFile = await loadManifest(manifestPath);
  let downloaded = 0;
  let skipped = 0;

  for (const blob of blobs) {
    const dest = objectToLocalFile(base, blob.name);
    const prev = manifest.entries[blob.name];

    if (
      entryUnchanged(prev, {
        generation: blob.generation,
        md5Hash: blob.md5Hash,
        size: blob.size,
      })
    ) {
      skipped++;
      continue;
    }

    await ensureParentDir(dest);
    console.log(`${LOG} fetch ${blob.name} → ${dest}`);
    await downloadBlobToFile(storage, bucket, blob.name, dest);

    const entry: ManifestEntry = {
      generation: blob.generation,
      md5Hash: blob.md5Hash,
      crc32c: blob.crc32c,
      size: blob.size,
      downloadedAt: new Date().toISOString(),
    };
    manifest.entries[blob.name] = entry;
    downloaded++;
  }

  await saveManifest(manifestPath, manifest);

  console.log(`${LOG} Done. Downloaded: ${downloaded}, unchanged skipped: ${skipped}`);

  console.log(`${LOG} Building inventory…`);
  const inventory = await buildInventory(base);
  await writeFile(
    inventoryPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), files: inventory }, null, 2),
    "utf8",
  );
  console.log(`${LOG} Wrote ${inventoryPath} (${inventory.length} files)`);
}
