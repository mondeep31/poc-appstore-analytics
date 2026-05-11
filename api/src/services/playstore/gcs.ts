import { Storage } from "@google-cloud/storage";
import type { File } from "@google-cloud/storage";
import { PLAYSTORE_REPORT_PREFIXES } from "./constants.ts";

/** Path from GOOGLE_APPLICATION_CREDENTIALS (service account JSON). */
export function storageFromEnv(): Storage {
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!keyFilename) {
    throw new Error(
      "Set GOOGLE_APPLICATION_CREDENTIALS to the path of your GCS service account JSON",
    );
  }
  return new Storage({ keyFilename });
}

export interface ListedBlob {
  name: string;
  bucket: string;
  size: number;
  generation?: string;
  md5Hash?: string;
  crc32c?: string;
  updated?: string;
}

function metadataString(value: string | number | undefined | null): string | undefined {
  if (value == null) return undefined;
  return String(value);
}

function fileToListedBlob(bucketName: string, file: File): ListedBlob {
  const meta = file.metadata;
  const size = typeof meta.size === "string" ? parseInt(meta.size, 10) : Number(meta.size ?? 0);
  return {
    name: file.name,
    bucket: bucketName,
    size: Number.isFinite(size) ? size : 0,
    generation: metadataString(meta.generation),
    md5Hash: metadataString(meta.md5Hash),
    crc32c: metadataString(meta.crc32c),
    updated: metadataString(meta.updated),
  };
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

export async function listReportBlobs(
  storage: Storage,
  bucketName: string,
  options: {
    prefixes?: readonly string[];
    packageName?: string;
  } = {},
): Promise<ListedBlob[]> {
  const prefixes =
    options.prefixes ?? [...PLAYSTORE_REPORT_PREFIXES];
  const bucket = storage.bucket(bucketName);
  const seen = new Set<string>();
  const out: ListedBlob[] = [];

  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix, autoPaginate: true });
    for (const file of files) {
      if (seen.has(file.name)) continue;
      if (!matchesPackageFilter(file.name, options.packageName)) continue;
      seen.add(file.name);
      out.push(fileToListedBlob(bucketName, file));
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
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
