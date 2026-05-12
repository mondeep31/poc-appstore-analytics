import path from "node:path";
import fs from "node:fs";

/** Local-calendar YYYYMM for month boundaries (cron TZ is Asia/Kolkata; server local is fine for day-of-month rules). */
function toYyyyMm(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

function prevYyyyMm(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const month1Based = Number(ym.slice(4, 6));
  const d = new Date(y, month1Based - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return toYyyyMm(d);
}

/** On-disk installs overview CSV for a month — used as bootstrap "do we already have this month" signal. */
export function installsOverviewPath(rawBase: string, packageName: string, yyyyMm: string): string {
  return path.join(
    rawBase,
    "stats",
    "installs",
    `installs_${packageName}_${yyyyMm}_overview.csv`,
  );
}

/**
 * GCS list prefixes for one month + package (dotted package id, e.g. ai.tradesea.app).
 */
export function gcsPrefixesForMonth(packageName: string, yyyyMm: string): string[] {
  const p = packageName.trim();
  return [
    `reviews/reviews_${p}_${yyyyMm}`,
    `stats/installs/installs_${p}_${yyyyMm}_`,
    `stats/ratings/ratings_${p}_${yyyyMm}_`,
    `stats/store_performance/store_performance_${p}_${yyyyMm}_`,
    `stats/store_performance/total_store_performance_${p}_${yyyyMm}_`,
    `stats/crashes/crashes_${p}_${yyyyMm}_`,
  ];
}

/**
 * Which calendar months to sync from GCS:
 * - Always include current month; include previous month when local day <= 4 (late-write window).
 * - Bootstrap: walk backward from current month up to 12 steps; for each month without an overview file on disk, include it; stop at first month that already has the overview file.
 */
export function getMonthsToSync(rawBase: string, packageName: string): string[] {
  const pkg = packageName.trim();
  if (!pkg) return [];

  const now = new Date();
  const day = now.getDate();
  const currentYm = toYyyyMm(now);

  const months = new Set<string>();
  months.add(currentYm);
  if (day <= 4) {
    months.add(prevYyyyMm(currentYm));
  }

  let cursor = currentYm;
  for (let i = 0; i < 12; i++) {
    const ov = installsOverviewPath(rawBase, pkg, cursor);
    if (fs.existsSync(ov)) {
      break;
    }
    months.add(cursor);
    cursor = prevYyyyMm(cursor);
  }

  return Array.from(months).sort();
}
