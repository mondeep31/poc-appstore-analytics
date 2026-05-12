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
              daily_crashes AS crashes,
              daily_anrs AS anrs
       FROM play_crashes_overview_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?
       ORDER BY date`,
    )
    .all(DEFAULT_APP_ID, startDate, endDate) as Array<{
    date: string;
    crashes: number | null;
    anrs: number | null;
  }>;

  return c.json({
    startDate,
    endDate,
    trend: rows.map((r) => ({
      date: r.date,
      crashes: r.crashes ?? 0,
      anrs: r.anrs ?? 0,
    })),
  });
});

export default router;
