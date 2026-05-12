import { Hono } from "hono";
import { z } from "zod";

import { DEFAULT_APP_ID, getDb } from "../../db/index.ts";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const router = new Hono();

router.get("/", (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query", detail: parsed.error.flatten() }, 400);
  }
  const { startDate, endDate, limit } = parsed.data;
  const db = getDb();

  const rows = db
    .query(
      `SELECT app_version_code AS code,
              COALESCE(SUM(daily_crashes), 0) AS crashes,
              COALESCE(SUM(daily_anrs), 0) AS anrs
       FROM play_crashes_app_version_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?
       GROUP BY app_version_code
       ORDER BY crashes DESC
       LIMIT ?`,
    )
    .all(DEFAULT_APP_ID, startDate, endDate, limit) as Array<{
    code: number;
    crashes: number;
    anrs: number;
  }>;

  return c.json({
    startDate,
    endDate,
    limit,
    versions: rows.map((r) => ({
      appVersionCode: r.code,
      crashes: r.crashes ?? 0,
      anrs: r.anrs ?? 0,
    })),
  });
});

export default router;
