import { readFile, writeFile } from "node:fs/promises";

export interface ManifestEntry {
  generation?: string;
  md5Hash?: string;
  crc32c?: string;
  size: number;
  downloadedAt: string;
}

export interface ManifestFile {
  updatedAt: string;
  entries: Record<string, ManifestEntry>;
}

export async function loadManifest(path: string): Promise<ManifestFile> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as ManifestFile;
    if (!parsed.entries || typeof parsed.entries !== "object") {
      return { updatedAt: new Date().toISOString(), entries: {} };
    }
    return parsed;
  } catch {
    return { updatedAt: new Date().toISOString(), entries: {} };
  }
}

export async function saveManifest(path: string, manifest: ManifestFile): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  await writeFile(path, JSON.stringify(manifest, null, 2), "utf8");
}

export function entryUnchanged(
  prev: ManifestEntry | undefined,
  blob: { generation?: string; md5Hash?: string; size: number },
): boolean {
  if (!prev) return false;
  if (prev.size !== blob.size) return false;
  if (blob.generation && prev.generation && prev.generation === blob.generation) return true;
  if (blob.md5Hash && prev.md5Hash && prev.md5Hash === blob.md5Hash) return true;
  return false;
}
