import { Hono } from "hono";
import { z } from "zod";

import { DEFAULT_APP_ID, getDb } from "../../db/index.ts";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
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

  const countRow = db
    .query(
      `SELECT COUNT(*) AS n
       FROM play_review
       WHERE app_id = ?
         AND date(submitted_at) >= date(?)
         AND date(submitted_at) <= date(?)`,
    )
    .get(DEFAULT_APP_ID, startDate, endDate) as { n: number } | null;

  const rows = db
    .query(
      `SELECT review_id, app_version_code, app_version_name, reviewer_language, device,
              submitted_at, last_updated_at, star_rating, title, body,
              developer_replied_at, developer_reply_text, review_link
       FROM play_review
       WHERE app_id = ?
         AND date(submitted_at) >= date(?)
         AND date(submitted_at) <= date(?)
       ORDER BY submitted_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(DEFAULT_APP_ID, startDate, endDate, limit, offset) as Array<{
    review_id: string;
    app_version_code: number | null;
    app_version_name: string | null;
    reviewer_language: string | null;
    device: string | null;
    submitted_at: string | null;
    last_updated_at: string | null;
    star_rating: number | null;
    title: string | null;
    body: string | null;
    developer_replied_at: string | null;
    developer_reply_text: string | null;
    review_link: string | null;
  }>;

  return c.json({
    startDate,
    endDate,
    total: countRow?.n ?? 0,
    reviews: rows.map((r) => ({
      id: r.review_id,
      appVersionCode: r.app_version_code,
      appVersionName: r.app_version_name,
      reviewerLanguage: r.reviewer_language,
      device: r.device,
      submittedAt: r.submitted_at,
      lastUpdatedAt: r.last_updated_at,
      rating: r.star_rating,
      title: r.title ?? "",
      body: r.body ?? "",
      developerRepliedAt: r.developer_replied_at,
      developerReplyText: r.developer_reply_text,
      reviewLink: r.review_link,
    })),
  });
});

export default router;
