import path from "node:path";
import { mkdir } from "node:fs/promises";

import { PLAYSTORE_REPORT_PREFIXES } from "./constants.ts";
import {
  downloadBlobToFile,
  iterReportFiles,
  storageFromEnv,
} from "./gcs.ts";
import {
  entryUnchanged,
  loadManifest,
  saveManifest,
  type ManifestEntry,
  type ManifestFile,
} from "./manifest.ts";

const LOG = "[playstore-download]";

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

function manifestEntryFromFile(
  bucket: string,
  file: import("@google-cloud/storage").File,
): ManifestEntry {
  const meta = file.metadata;
  const size =
    typeof meta.size === "string" ? parseInt(meta.size, 10) : Number(meta.size ?? 0);
  const gen = meta.generation;
  const md5 = meta.md5Hash;
  const crc = meta.crc32c;
  return {
    generation: gen == null ? undefined : String(gen),
    md5Hash: md5 == null ? undefined : String(md5),
    crc32c: crc == null ? undefined : String(crc),
    size: Number.isFinite(size) ? size : 0,
    downloadedAt: new Date().toISOString(),
  };
}

/**
 * Streams Play bulk-report objects from GCS and downloads each file one-by-one (no full in-memory listing, no inventory preview).
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

  const storage = storageFromEnv();
  console.log(
    `${LOG} Streaming gs://${bucket}/ (prefixes: ${PLAYSTORE_REPORT_PREFIXES.join(", ")}) — download one object at a time`,
  );

  const manifest: ManifestFile = await loadManifest(manifestPath);
  let downloaded = 0;
  let skipped = 0;
  let seen = 0;

  for await (const file of iterReportFiles(storage, bucket, {
    prefixes: PLAYSTORE_REPORT_PREFIXES,
    packageName: pkg,
  })) {
    seen++;
    const objectName = file.name;
    const dest = objectToLocalFile(base, objectName);
    const prev = manifest.entries[objectName];

    const meta = file.metadata;
    const size =
      typeof meta.size === "string" ? parseInt(meta.size, 10) : Number(meta.size ?? 0);
    const generation = meta.generation == null ? undefined : String(meta.generation);
    const md5Hash = meta.md5Hash == null ? undefined : String(meta.md5Hash);

    if (
      entryUnchanged(prev, {
        generation,
        md5Hash,
        size: Number.isFinite(size) ? size : 0,
      })
    ) {
      skipped++;
      continue;
    }

    await ensureParentDir(dest);
    console.log(`${LOG} [${seen}] fetch ${objectName} → ${dest}`);
    await downloadBlobToFile(storage, bucket, objectName, dest);

    manifest.entries[objectName] = manifestEntryFromFile(bucket, file);
    downloaded++;
    await saveManifest(manifestPath, manifest);
  }

  console.log(`${LOG} Done. Objects seen: ${seen}, downloaded: ${downloaded}, unchanged skipped: ${skipped}`);
}
