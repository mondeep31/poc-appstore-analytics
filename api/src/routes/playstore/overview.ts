import { Hono } from "hono";
import { z } from "zod";

import { DEFAULT_APP_ID, getDb } from "../../db/index.ts";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const router = new Hono();

router.get("/", (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query", detail: parsed.error.flatten() }, 400);
  }
  const { startDate, endDate } = parsed.data;
  const db = getDb();
  const appId = DEFAULT_APP_ID;

  const totals = db
    .query(
      `SELECT
         COALESCE(SUM(daily_user_installs), 0) AS totalInstalls,
         COALESCE(SUM(daily_user_uninstalls), 0) AS totalUninstalls
       FROM play_installs_overview_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?`,
    )
    .get(appId, startDate, endDate) as {
    totalInstalls: number;
    totalUninstalls: number;
  } | null;

  const top = db
    .query(
      `SELECT country AS c, SUM(daily_user_installs) AS downloads
       FROM play_installs_country_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?
       GROUP BY country
       ORDER BY downloads DESC
       LIMIT 1`,
    )
    .get(appId, startDate, endDate) as { c: string; downloads: number } | null;

  const cc = db
    .query(
      `SELECT COUNT(*) AS n FROM (
         SELECT country
         FROM play_installs_country_daily
         WHERE app_id = ? AND date BETWEEN ? AND ?
         GROUP BY country
         HAVING SUM(daily_user_installs) > 0
       )`,
    )
    .get(appId, startDate, endDate) as { n: number } | null;

  const ratingRow = db
    .query(
      `SELECT total_avg_rating AS r
       FROM play_ratings_overview_daily
       WHERE app_id = ? AND date <= ?
       ORDER BY date DESC
       LIMIT 1`,
    )
    .get(appId, endDate) as { r: number | null } | null;

  return c.json({
    startDate,
    endDate,
    totalInstalls: totals?.totalInstalls ?? 0,
    totalUninstalls: totals?.totalUninstalls ?? 0,
    topCountry: top?.c ?? null,
    topCountryDownloads: top?.downloads ?? 0,
    avgRating: ratingRow?.r ?? null,
    countriesCount: cc?.n ?? 0,
  });
});

export default router;
