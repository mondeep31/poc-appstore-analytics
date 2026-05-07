import { Hono } from "hono";
import { fetchCustomerReviews } from "../../services/apple/reviews.ts";

const router = new Hono();

function getAppId(c: { req: { query: (key: string) => string | undefined } }) {
  return c.req.query("appId") ?? process.env.APPLE_APP_ID ?? "";
}

// GET /api/appstore/reviews?appId=...&limit=50&sort=-createdDate&filterRating=1&cursor=...
router.get("/", async (c) => {
  const appId = getAppId(c);
  if (!appId) {
    return c.json({ error: "appId query param or APPLE_APP_ID env required" }, 400);
  }

  const limit = Math.min(200, parseInt(c.req.query("limit") ?? "50", 10));
  const sort = c.req.query("sort") ?? "-createdDate";
  const cursor = c.req.query("cursor");
  const filterRatingStr = c.req.query("filterRating");
  const filterTerritory = c.req.query("filterTerritory");

  try {
    const result = await fetchCustomerReviews(appId, {
      limit,
      sort,
      cursor,
      filterRating: filterRatingStr ? parseInt(filterRatingStr, 10) : undefined,
      filterTerritory,
    });

    return c.json({
      reviews: result.reviews,
      totalCount: result.totalCount,
      nextCursor: result.nextCursor,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

export default router;
