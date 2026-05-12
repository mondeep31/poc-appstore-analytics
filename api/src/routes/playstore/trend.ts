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
  const rows = db
    .query(
      `SELECT date,
              SUM(daily_user_installs) AS installs,
              SUM(daily_user_uninstalls) AS uninstalls
       FROM play_installs_overview_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?
       GROUP BY date
       ORDER BY date`,
    )
    .all(DEFAULT_APP_ID, startDate, endDate) as Array<{
    date: string;
    installs: number;
    uninstalls: number;
  }>;

  return c.json({
    startDate,
    endDate,
    trend: rows.map((r) => ({
      date: r.date,
      installs: r.installs ?? 0,
      uninstalls: r.uninstalls ?? 0,
    })),
  });
});

export default router;
