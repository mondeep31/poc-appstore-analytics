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
 * Package appears in Play filenames as dots → underscores (e.g. com.foo.bar → com_foo_bar).
 */
export function packageFilenameToken(packageName: string): string {
  return packageName.trim().replace(/\./g, "_");
}

/**
 * Include blob if package filter matches filename, or no filter is set.
 */
export function matchesPackageFilter(blobName: string, packageName: string | undefined): boolean {
  if (!packageName?.trim()) return true;
  const token = packageFilenameToken(packageName);
  return blobName.includes(token);
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
    const stream = bucket.getFilesStream({ prefix });
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

export async function downloadBlobToFile(
  storage: Storage,
  bucketName: string,
  objectName: string,
  destPath: string,
): Promise<void> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.download({ destination: destPath });
}
