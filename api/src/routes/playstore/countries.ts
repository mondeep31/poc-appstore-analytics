import { Hono } from "hono";
import { z } from "zod";

import { DEFAULT_APP_ID, getDb } from "../../db/index.ts";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
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
      `SELECT country AS c, SUM(daily_user_installs) AS downloads
       FROM play_installs_country_daily
       WHERE app_id = ? AND date BETWEEN ? AND ?
       GROUP BY country
       ORDER BY downloads DESC
       LIMIT ?`,
    )
    .all(DEFAULT_APP_ID, startDate, endDate, limit) as Array<{
    c: string;
    downloads: number;
  }>;

  return c.json({
    startDate,
    endDate,
    countries: rows.map((r) => ({ country: r.c, downloads: r.downloads ?? 0 })),
  });
});

export default router;
