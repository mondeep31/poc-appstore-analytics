import { Hono } from "hono";
import { z } from "zod";

import { DEFAULT_APP_ID, getDb } from "../../db/index.ts";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const router = new Hono();

router.get("/", (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query", detail: parsed.error.flatten() }, 400);
  }
  const { startDate, endDate, limit, offset } = parsed.data;
  const db = getDb();

  const totalRow = db
    .query(
      `SELECT COUNT(*) AS n
       FROM play_crashes_device_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?`,
    )
    .get(DEFAULT_APP_ID, startDate, endDate) as { n: number } | null;

  const rows = db
    .query(
      `SELECT date,
              device,
              daily_crashes AS crashes,
              daily_anrs AS anrs
       FROM play_crashes_device_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC, daily_crashes DESC
       LIMIT ? OFFSET ?`,
    )
    .all(DEFAULT_APP_ID, startDate, endDate, limit, offset) as Array<{
    date: string;
    device: string;
    crashes: number | null;
    anrs: number | null;
  }>;

  return c.json({
    startDate,
    endDate,
    limit,
    offset,
    total: totalRow?.n ?? 0,
    rows: rows.map((r) => ({
      date: r.date,
      device: r.device,
      crashes: r.crashes ?? 0,
      anrs: r.anrs ?? 0,
    })),
  });
});

export default router;
