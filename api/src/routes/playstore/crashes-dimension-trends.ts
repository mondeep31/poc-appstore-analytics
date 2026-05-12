import { Hono } from "hono";
import { z } from "zod";

import { DEFAULT_APP_ID, getDb } from "../../db/index.ts";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topN: z.coerce.number().int().min(1).max(8).optional().default(5),
});

const router = new Hono();

router.get("/", (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query", detail: parsed.error.flatten() }, 400);
  }
  const { startDate, endDate, topN } = parsed.data;
  const db = getDb();
  const appId = DEFAULT_APP_ID;

  const topOs = db
    .query(
      `SELECT os_version AS os,
              COALESCE(SUM(daily_crashes), 0) AS total
       FROM play_crashes_os_version_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?
       GROUP BY os_version
       ORDER BY total DESC
       LIMIT ?`,
    )
    .all(appId, startDate, endDate, topN) as Array<{ os: string; total: number }>;

  const osTrends = topOs.map((row) => {
    const series = db
      .query(
        `SELECT date,
                COALESCE(daily_crashes, 0) AS crashes,
                COALESCE(daily_anrs, 0) AS anrs
         FROM play_crashes_os_version_daily
         WHERE app_id = ? AND date BETWEEN ? AND ? AND os_version = ?
         ORDER BY date`,
      )
      .all(appId, startDate, endDate, row.os) as Array<{
      date: string;
      crashes: number;
      anrs: number;
    }>;
    return {
      osVersion: row.os,
      series: series.map((s) => ({
        date: s.date,
        crashes: s.crashes ?? 0,
        anrs: s.anrs ?? 0,
      })),
    };
  });

  const topApps = db
    .query(
      `SELECT app_version_code AS code,
              COALESCE(SUM(daily_crashes), 0) AS total
       FROM play_crashes_app_version_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?
       GROUP BY app_version_code
       ORDER BY total DESC
       LIMIT ?`,
    )
    .all(appId, startDate, endDate, topN) as Array<{ code: number; total: number }>;

  const appTrends = topApps.map((row) => {
    const series = db
      .query(
        `SELECT date,
                COALESCE(daily_crashes, 0) AS crashes,
                COALESCE(daily_anrs, 0) AS anrs
         FROM play_crashes_app_version_daily
         WHERE app_id = ? AND date BETWEEN ? AND ? AND app_version_code = ?
         ORDER BY date`,
      )
      .all(appId, startDate, endDate, row.code) as Array<{
      date: string;
      crashes: number;
      anrs: number;
    }>;
    return {
      appVersionCode: row.code,
      series: series.map((s) => ({
        date: s.date,
        crashes: s.crashes ?? 0,
        anrs: s.anrs ?? 0,
      })),
    };
  });

  return c.json({
    startDate,
    endDate,
    topN,
    note:
      "Play bulk exports separate os_version and app_version reports; there is no per-cell OS×build joint table. Compare daily shapes here for timing only.",
    osTrends,
    appTrends,
  });
});

export default router;
