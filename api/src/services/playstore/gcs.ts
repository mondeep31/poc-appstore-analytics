import { Storage } from "@google-cloud/storage";
import type { File } from "@google-cloud/storage";
import { PLAYSTORE_REPORT_PREFIXES } from "./constants.ts";

/** OAuth scope required by Google for Play bulk report downloads — see support answer 6135870. */
export const PLAYSTORE_GCS_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

/** Path from GOOGLE_APPLICATION_CREDENTIALS (service account JSON). */
export function storageFromEnv(): Storage {
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!keyFilename) {
    throw new Error(
      "Set GOOGLE_APPLICATION_CREDENTIALS to the path of your GCS service account JSON",
    );
  }
  return new Storage({
    keyFilename,
    scopes: [PLAYSTORE_GCS_SCOPE],
  });
}

/**
 * Package appears in Play bulk-report filenames with dots preserved
 * (e.g. reviews_com.example.app_202602.csv).
 */
export function packageFilenameToken(packageName: string): string {
  return packageName.trim();
}

/**
 * Include blob if package filter matches filename, or no filter is set.
 * Accepts both dotted (current Play format) and underscored (legacy) variants.
 */
export function matchesPackageFilter(
  blobName: string,
  packageName: string | undefined,
): boolean {
  const pkg = packageName?.trim();
  if (!pkg) return true;
  const dotted = pkg;
  const underscored = pkg.replace(/\./g, "_");
  return blobName.includes(dotted) || blobName.includes(underscored);
}

/**
 * Stream matching report objects from GCS (paginated list) and yield each file.
 * Consume sequentially and download one-by-one — avoids holding the full object list in memory.
 */
export async function* iterReportFiles(
  storage: Storage,
  bucketName: string,
  options: {
    prefixes?: readonly string[];
    packageName?: string;
  } = {},
): AsyncGenerator<File> {
  const prefixes = options.prefixes ?? [...PLAYSTORE_REPORT_PREFIXES];
  const bucket = storage.bucket(bucketName);
  const seen = new Set<string>();

  for (const prefix of prefixes) {
    const p = prefix.trim();
    if (!p) {
      throw new Error(
        "Empty GCS prefix is not allowed for Play export buckets — listing the bucket root may be denied (403). Use strict prefixes such as stats/installs/ or reviews/.",
      );
    }
    const stream = bucket.getFilesStream({ prefix: p });
    for await (const chunk of stream as AsyncIterable<File | File[]>) {
      const batch = Array.isArray(chunk) ? chunk : [chunk];
      for (const file of batch) {
        if (!file?.name) continue;
        if (seen.has(file.name)) continue;
        if (!matchesPackageFilter(file.name, options.packageName)) continue;
        seen.add(file.name);
        yield file;
      }
    }
  }
}

const runningOnBun = typeof process.versions.bun === "string";

export async function downloadBlobToFile(
  storage: Storage,
  bucketName: string,
  objectName: string,
  destPath: string,
): Promise<void> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);
  // Under Bun, @google-cloud/storage + the HTTP stack often disagree with Node:
  // - CRC32C validation can false-positive (CONTENT_DOWNLOAD_MISMATCH).
  // - Responses may already be gunzipped by the runtime while headers still say
  //   gzip; the client's extra createGunzip() then hits plain text → Z_DATA_ERROR
  //   ("incorrect header check"). Skip client decompress + validation on Bun only.
  await file.download({
    destination: destPath,
    ...(runningOnBun ? { validation: false, decompress: false } : {}),
  });
}
