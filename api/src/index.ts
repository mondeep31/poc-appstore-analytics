import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import authRouter from "./routes/auth.ts";
import appsRouter from "./routes/appstore/apps.ts";
import salesRouter from "./routes/appstore/sales.ts";
import reviewsRouter from "./routes/appstore/reviews.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { startPlaystoreDownloadScheduler } from "./playstore-scheduler.ts";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasAppleKeyId: !!process.env.APPLE_KEY_ID,
      hasAppleIssuerId: !!process.env.APPLE_ISSUER_ID,
      hasApplePrivateKey: !!process.env.APPLE_PRIVATE_KEY_BASE64,
      hasVendorNumber: !!process.env.APPLE_VENDOR_NUMBER,
      appId: process.env.APPLE_APP_ID ?? "not set",
      playstore: {
        hasGcsBucket: !!process.env.PLAYSTORE_GCS_BUCKET?.trim(),
        hasPackageName: !!process.env.PLAYSTORE_PACKAGE_NAME?.trim(),
        hasGoogleAppCredsPath: !!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
        rawDir: process.env.PLAYSTORE_RAW_DIR?.trim() || "(default data/playstore/raw)",
        downloadScheduleEnabled: ["1", "true", "yes"].includes(
          (process.env.PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED ?? "").trim().toLowerCase(),
        ),
        downloadCron: process.env.PLAYSTORE_DOWNLOAD_CRON?.trim() || "(default 5 18 * * *)",
        downloadTz: process.env.PLAYSTORE_DOWNLOAD_TZ?.trim() || "(default Asia/Kolkata IST)",
      },
    },
  })
);

// Auth (no JWT middleware)
app.route("/auth", authRouter);

// All AppStore routes require dashboard JWT
app.use("/api/*", authMiddleware);
app.route("/api/appstore/apps", appsRouter);
app.route("/api/appstore/sales", salesRouter);
app.route("/api/appstore/reviews", reviewsRouter);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error", detail: err.message }, 500);
});

const port = parseInt(process.env.PORT ?? "4000", 10);

console.log(`🚀 Analytics API running on http://localhost:${port}`);

startPlaystoreDownloadScheduler();

export default {
  port,
  fetch: app.fetch,
  // Sales reports fetch many days concurrently and Apple's API can be slow
  idleTimeout: 120,
};
