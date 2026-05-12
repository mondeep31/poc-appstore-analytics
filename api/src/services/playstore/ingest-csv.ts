import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Glob } from "bun";
import { parse } from "csv-parse/sync";

import { DEFAULT_APP_ID, getDb } from "../../db/index.ts";
import { peekFirstLine } from "./text-decode.ts";

const LOG = "[playstore-ingest]";

/** Play bulk CSVs are usually UTF-16 LE (with or without BOM); decode to JS string. */
export function readPlaystoreCsvText(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const body = buf.subarray(2);
    const swapped = Buffer.alloc(body.length);
    for (let i = 0; i + 1 < body.length; i += 2) {
      swapped[i] = body[i + 1]!;
      swapped[i + 1] = body[i]!;
    }
    return swapped.toString("utf16le").replace(/^\uFEFF/, "");
  }
  const { encoding } = peekFirstLine(buf);
  if (encoding === "utf-16le") {
    return buf.toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (encoding === "utf-16be") {
    const swapped = Buffer.alloc(buf.length);
    for (let i = 0; i + 1 < buf.length; i += 2) {
      swapped[i] = buf[i + 1]!;
      swapped[i + 1] = buf[i]!;
    }
    return swapped.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return buf.toString("utf8").replace(/^\uFEFF/, "");
}

function readUtf8(filePath: string): string {
  return readPlaystoreCsvText(filePath);
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

function findCol(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = norm.indexOf(c.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function intAt(cells: string[], idx: number): number {
  if (idx < 0) return 0;
  const t = (cells[idx] ?? "").trim();
  if (!t) return 0;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : 0;
}

function floatAt(cells: string[], idx: number): number | null {
  if (idx < 0) return null;
  const t = (cells[idx] ?? "").trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function matchesPkgBasename(basename: string, kind: "installs" | "ratings" | "reviews", pkg: string): boolean {
  if (kind === "installs") {
    return basename.startsWith(`installs_${pkg}_`);
  }
  if (kind === "ratings") {
    return basename.startsWith(`ratings_${pkg}_`);
  }
  return basename.startsWith(`reviews_${pkg}_`);
}

function matchesCrashBasename(
  basename: string,
  pkg: string,
  kind: "overview" | "device" | "app_version" | "os_version",
): boolean {
  if (!basename.startsWith(`crashes_${pkg}_`)) return false;
  switch (kind) {
    case "overview":
      return basename.endsWith("_overview.csv");
    case "device":
      return basename.endsWith("_device.csv");
    case "app_version":
      return basename.endsWith("_app_version.csv");
    case "os_version":
      return basename.endsWith("_os_version.csv");
  }
}

function ingestInstallsOverviewFile(filePath: string, appId: number): number {
  const text = readUtf8(filePath);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return 0;

  const headers = splitCsvLine(lines[0]);
  const iDate = findCol(headers, ["Date"]);
  const iDdi = findCol(headers, ["Daily Device Installs"]);
  const iDdu = findCol(headers, ["Daily Device Uninstalls"]);
  const iDdup = findCol(headers, ["Daily Device Upgrades"]);
  const iTui = findCol(headers, ["Total User Installs"]);
  const iDui = findCol(headers, ["Daily User Installs"]);
  const iDuu = findCol(headers, ["Daily User Uninstalls"]);
  const iAdi = findCol(headers, ["Active Device Installs"]);
  const iIe = findCol(headers, ["Install events"]);
  const iUe = findCol(headers, ["Update events"]);
  const iUne = findCol(headers, ["Uninstall events"]);

  if (iDate < 0) {
    console.warn(`${LOG} skip ${filePath} — no Date column`);
    return 0;
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO play_installs_overview_daily (
      app_id, date, daily_device_installs, daily_device_uninstalls, daily_device_upgrades,
      total_user_installs, daily_user_installs, daily_user_uninstalls, active_device_installs,
      install_events, update_events, uninstall_events
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (let li = 1; li < lines.length; li++) {
      const cells = splitCsvLine(lines[li]);
      const date = (cells[iDate] ?? "").trim();
      if (!date) continue;
      stmt.run(
        appId,
        date,
        intAt(cells, iDdi),
        intAt(cells, iDdu),
        intAt(cells, iDdup),
        intAt(cells, iTui),
        intAt(cells, iDui),
        intAt(cells, iDuu),
        intAt(cells, iAdi),
        intAt(cells, iIe),
        intAt(cells, iUe),
        intAt(cells, iUne),
      );
      n++;
    }
  });
  run();
  return n;
}

function ingestInstallsCountryFile(filePath: string, appId: number): number {
  const text = readUtf8(filePath);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return 0;

  const headers = splitCsvLine(lines[0]);
  const iDate = findCol(headers, ["Date"]);
  const iCountry = findCol(headers, ["Country", "Country / region"]);
  const iDdi = findCol(headers, ["Daily Device Installs"]);
  const iDdu = findCol(headers, ["Daily Device Uninstalls"]);
  const iDui = findCol(headers, ["Daily User Installs"]);
  const iDuu = findCol(headers, ["Daily User Uninstalls"]);
  const iAdi = findCol(headers, ["Active Device Installs"]);
  const iIe = findCol(headers, ["Install events"]);
  const iUne = findCol(headers, ["Uninstall events"]);

  if (iDate < 0 || iCountry < 0) {
    console.warn(`${LOG} skip ${filePath} — missing Date or Country`);
    return 0;
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO play_installs_country_daily (
      app_id, date, country, daily_device_installs, daily_device_uninstalls,
      daily_user_installs, daily_user_uninstalls, active_device_installs,
      install_events, uninstall_events
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (let li = 1; li < lines.length; li++) {
      const cells = splitCsvLine(lines[li]);
      const date = (cells[iDate] ?? "").trim();
      const country = (cells[iCountry] ?? "").trim();
      if (!date || !country) continue;
      stmt.run(
        appId,
        date,
        country,
        intAt(cells, iDdi),
        intAt(cells, iDdu),
        intAt(cells, iDui),
        intAt(cells, iDuu),
        intAt(cells, iAdi),
        intAt(cells, iIe),
        intAt(cells, iUne),
      );
      n++;
    }
  });
  run();
  return n;
}

function ingestRatingsOverviewFile(filePath: string, appId: number): number {
  const text = readUtf8(filePath);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return 0;

  const headers = splitCsvLine(lines[0]);
  const iDate = findCol(headers, ["Date"]);
  const iDaily = findCol(headers, ["Daily Average Rating"]);
  const iTotal = findCol(headers, ["Total Average Rating"]);

  if (iDate < 0) {
    console.warn(`${LOG} skip ${filePath} — no Date column`);
    return 0;
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO play_ratings_overview_daily (app_id, date, daily_avg_rating, total_avg_rating)
     VALUES (?,?,?,?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (let li = 1; li < lines.length; li++) {
      const cells = splitCsvLine(lines[li]);
      const date = (cells[iDate] ?? "").trim();
      if (!date) continue;
      stmt.run(appId, date, floatAt(cells, iDaily), floatAt(cells, iTotal));
      n++;
    }
  });
  run();
  return n;
}

function ingestCrashesOverviewFile(filePath: string, appId: number): number {
  const text = readUtf8(filePath);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return 0;

  const headers = splitCsvLine(lines[0]);
  const iDate = findCol(headers, ["Date"]);
  const iCrashes = findCol(headers, ["Daily Crashes"]);
  const iAnrs = findCol(headers, ["Daily ANRs"]);

  if (iDate < 0 || iCrashes < 0 || iAnrs < 0) {
    console.warn(`${LOG} skip ${filePath} — missing Date / Daily Crashes / Daily ANRs`);
    return 0;
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO play_crashes_overview_daily (app_id, date, daily_crashes, daily_anrs)
     VALUES (?,?,?,?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (let li = 1; li < lines.length; li++) {
      const cells = splitCsvLine(lines[li]);
      const date = (cells[iDate] ?? "").trim();
      if (!date) continue;
      stmt.run(appId, date, intAt(cells, iCrashes), intAt(cells, iAnrs));
      n++;
    }
  });
  run();
  return n;
}

function ingestCrashesDeviceFile(filePath: string, appId: number): number {
  const text = readUtf8(filePath);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return 0;

  const headers = splitCsvLine(lines[0]);
  const iDate = findCol(headers, ["Date"]);
  const iDevice = findCol(headers, ["Device"]);
  const iCrashes = findCol(headers, ["Daily Crashes"]);
  const iAnrs = findCol(headers, ["Daily ANRs"]);

  if (iDate < 0 || iDevice < 0 || iCrashes < 0 || iAnrs < 0) {
    console.warn(`${LOG} skip ${filePath} — missing Date / Device / Daily Crashes / Daily ANRs`);
    return 0;
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO play_crashes_device_daily (app_id, date, device, daily_crashes, daily_anrs)
     VALUES (?,?,?,?,?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (let li = 1; li < lines.length; li++) {
      const cells = splitCsvLine(lines[li]);
      const date = (cells[iDate] ?? "").trim();
      const device = (cells[iDevice] ?? "").trim();
      if (!date || !device) continue;
      stmt.run(appId, date, device, intAt(cells, iCrashes), intAt(cells, iAnrs));
      n++;
    }
  });
  run();
  return n;
}

function ingestCrashesAppVersionFile(filePath: string, appId: number): number {
  const text = readUtf8(filePath);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return 0;

  const headers = splitCsvLine(lines[0]);
  const iDate = findCol(headers, ["Date"]);
  const iCode = findCol(headers, ["App Version Code"]);
  const iCrashes = findCol(headers, ["Daily Crashes"]);
  const iAnrs = findCol(headers, ["Daily ANRs"]);

  if (iDate < 0 || iCode < 0 || iCrashes < 0 || iAnrs < 0) {
    console.warn(`${LOG} skip ${filePath} — missing Date / App Version Code / Daily Crashes / Daily ANRs`);
    return 0;
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO play_crashes_app_version_daily (
      app_id, date, app_version_code, daily_crashes, daily_anrs
    ) VALUES (?,?,?,?,?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (let li = 1; li < lines.length; li++) {
      const cells = splitCsvLine(lines[li]);
      const date = (cells[iDate] ?? "").trim();
      if (!date) continue;
      const codeStr = (cells[iCode] ?? "").trim();
      if (codeStr === "") continue;
      const code = parseInt(codeStr, 10);
      if (!Number.isFinite(code)) continue;
      stmt.run(appId, date, code, intAt(cells, iCrashes), intAt(cells, iAnrs));
      n++;
    }
  });
  run();
  return n;
}

function ingestCrashesOsVersionFile(filePath: string, appId: number): number {
  const text = readUtf8(filePath);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return 0;

  const headers = splitCsvLine(lines[0]);
  const iDate = findCol(headers, ["Date"]);
  const iOs = findCol(headers, ["Android OS Version"]);
  const iCrashes = findCol(headers, ["Daily Crashes"]);
  const iAnrs = findCol(headers, ["Daily ANRs"]);

  if (iDate < 0 || iOs < 0 || iCrashes < 0 || iAnrs < 0) {
    console.warn(`${LOG} skip ${filePath} — missing Date / Android OS Version / Daily Crashes / Daily ANRs`);
    return 0;
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO play_crashes_os_version_daily (
      app_id, date, os_version, daily_crashes, daily_anrs
    ) VALUES (?,?,?,?,?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (let li = 1; li < lines.length; li++) {
      const cells = splitCsvLine(lines[li]);
      const date = (cells[iDate] ?? "").trim();
      const osVer = (cells[iOs] ?? "").trim();
      if (!date || !osVer) continue;
      stmt.run(appId, date, osVer, intAt(cells, iCrashes), intAt(cells, iAnrs));
      n++;
    }
  });
  run();
  return n;
}

function reviewIdFromRow(link: string, millis: string, device: string): string {
  const m = link.match(/reviewId=([^&]+)/i);
  if (m?.[1]) return m[1];
  return createHash("sha256")
    .update(`${link}|${millis}|${device}`)
    .digest("hex");
}

function ingestReviewsFile(filePath: string, appId: number): number {
  const text = readUtf8(filePath);
  let rows: Record<string, string>[];
  try {
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, string>[];
  } catch (e) {
    console.warn(`${LOG} csv-parse failed ${filePath}:`, e);
    return 0;
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO play_review (
      review_id, app_id, app_version_code, app_version_name, reviewer_language, device,
      submitted_at, last_updated_at, star_rating, title, body,
      developer_replied_at, developer_reply_text, review_link
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (const row of rows) {
      const link = row["Review Link"] ?? "";
      const millis = row["Review Submit Millis Since Epoch"] ?? "";
      const device = row["Device"] ?? "";
      const id = reviewIdFromRow(link, millis, device);
      const vcode = row["App Version Code"] ?? "";
      const rating = row["Star Rating"] ?? "";
      stmt.run(
        id,
        appId,
        vcode ? parseInt(vcode, 10) || null : null,
        row["App Version Name"] ?? null,
        row["Reviewer Language"] ?? null,
        device || null,
        row["Review Submit Date and Time"] ?? null,
        row["Review Last Update Date and Time"] ?? null,
        rating ? parseInt(rating, 10) || null : null,
        row["Review Title"] ?? "",
        row["Review Text"] ?? "",
        row["Developer Reply Date and Time"] ?? null,
        row["Developer Reply Text"] ?? null,
        link || null,
      );
      n++;
    }
  });
  run();
  return n;
}

/**
 * Reads CSVs under rawBase and upserts into SQLite. Idempotent.
 */
export async function runPlaystoreIngest(
  rawBase: string,
  packageName: string | undefined,
): Promise<void> {
  if (!packageName?.trim()) {
    console.warn(`${LOG} Skip ingest — PLAYSTORE_PACKAGE_NAME unset`);
    return;
  }
  const pkg = packageName.trim();
  const appId = DEFAULT_APP_ID;
  let overviewRows = 0;
  let countryRows = 0;
  let ratingsRows = 0;
  let reviewRows = 0;
  let crashesOverviewRows = 0;
  let crashesDeviceRows = 0;
  let crashesAppVersionRows = 0;
  let crashesOsVersionRows = 0;

  for await (const rel of new Glob("stats/installs/*_overview.csv").scan({ cwd: rawBase })) {
    const full = path.join(rawBase, rel);
    const base = path.basename(full);
    if (!matchesPkgBasename(base, "installs", pkg) || !base.endsWith("_overview.csv")) continue;
    overviewRows += ingestInstallsOverviewFile(full, appId);
  }

  for await (const rel of new Glob("stats/installs/*_country.csv").scan({ cwd: rawBase })) {
    const full = path.join(rawBase, rel);
    const base = path.basename(full);
    if (!matchesPkgBasename(base, "installs", pkg) || !base.endsWith("_country.csv")) continue;
    countryRows += ingestInstallsCountryFile(full, appId);
  }

  for await (const rel of new Glob("stats/ratings/*_overview.csv").scan({ cwd: rawBase })) {
    const full = path.join(rawBase, rel);
    const base = path.basename(full);
    if (!matchesPkgBasename(base, "ratings", pkg) || !base.endsWith("_overview.csv")) continue;
    ratingsRows += ingestRatingsOverviewFile(full, appId);
  }

  for await (const rel of new Glob("reviews/reviews_*.csv").scan({ cwd: rawBase })) {
    const full = path.join(rawBase, rel);
    const base = path.basename(full);
    if (!matchesPkgBasename(base, "reviews", pkg)) continue;
    reviewRows += ingestReviewsFile(full, appId);
  }

  for await (const rel of new Glob("stats/crashes/*_overview.csv").scan({ cwd: rawBase })) {
    const full = path.join(rawBase, rel);
    const base = path.basename(full);
    if (!matchesCrashBasename(base, pkg, "overview")) continue;
    crashesOverviewRows += ingestCrashesOverviewFile(full, appId);
  }

  for await (const rel of new Glob("stats/crashes/*_device.csv").scan({ cwd: rawBase })) {
    const full = path.join(rawBase, rel);
    const base = path.basename(full);
    if (!matchesCrashBasename(base, pkg, "device")) continue;
    crashesDeviceRows += ingestCrashesDeviceFile(full, appId);
  }

  for await (const rel of new Glob("stats/crashes/*_app_version.csv").scan({ cwd: rawBase })) {
    const full = path.join(rawBase, rel);
    const base = path.basename(full);
    if (!matchesCrashBasename(base, pkg, "app_version")) continue;
    crashesAppVersionRows += ingestCrashesAppVersionFile(full, appId);
  }

  for await (const rel of new Glob("stats/crashes/*_os_version.csv").scan({ cwd: rawBase })) {
    const full = path.join(rawBase, rel);
    const base = path.basename(full);
    if (!matchesCrashBasename(base, pkg, "os_version")) continue;
    crashesOsVersionRows += ingestCrashesOsVersionFile(full, appId);
  }

  console.log(
    `${LOG} Done — overview rows: ${overviewRows}, country: ${countryRows}, ratings: ${ratingsRows}, reviews: ${reviewRows}, crashes overview: ${crashesOverviewRows}, crashes device: ${crashesDeviceRows}, crashes app_version: ${crashesAppVersionRows}, crashes os_version: ${crashesOsVersionRows}`,
  );
}
