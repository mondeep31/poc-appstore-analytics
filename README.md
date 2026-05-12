# TradeSea mobile analytics (App Store + Google Play)

A full-stack analytics dashboard: **Apple App Store Connect** APIs plus **Google Play** bulk reports mirrored from GCS into **SQLite** and served from the same API.

## Stack

- **API**: Bun + Hono + `bun:sqlite` (default port **4000**; set `PORT` in `.env` if needed)
- **Web**: Next.js + shadcn/ui + Recharts (dev default **http://localhost:3007** — see `analytics/web/package.json`)
- **Auth**: JWT (HS256, 24h) — demo login from `.env`: typically `admin` / `admin`

Point the web app at the API with `NEXT_PUBLIC_API_URL` in `analytics/web/.env.local` (e.g. `http://localhost:4200` if the API uses `PORT=4200`).

## Quick Start

### 1. Configure environment

```bash
cp analytics/api/.env.example analytics/api/.env
# Web: create analytics/web/.env.local with NEXT_PUBLIC_API_URL matching the API (e.g. http://localhost:4000)
```

### 2. Apple (App Store Connect)

Edit `analytics/api/.env` and fill in:

```bash
APPLE_KEY_ID=          # App Store Connect → Users and Access → Integrations → API Keys
APPLE_ISSUER_ID=       # Same page
APPLE_PRIVATE_KEY_BASE64=$(base64 -i ~/Downloads/AuthKey_XXXXX.p8)
APPLE_VENDOR_NUMBER=   # Payments and Financial Reports
APPLE_APP_ID=          # Optional — auto-fetched from /v1/apps if blank
```

### 3. Google Play (optional)

Play data comes from **bulk export objects in your linked GCS bucket** (not the Play Developer API in this PoC). Same `analytics/api/.env`:

```bash
PLAYSTORE_GCS_BUCKET=           # Bucket id only (no gs://)
PLAYSTORE_PACKAGE_NAME=         # e.g. com.example.app (dotted package id)
GOOGLE_APPLICATION_CREDENTIALS= # Path to service account JSON (Play-invited SA)
# Optional: PLAYSTORE_RAW_DIR, PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED, PLAYSTORE_DOWNLOAD_CRON, PLAYSTORE_DOWNLOAD_TZ
```

**Docs**: full pipeline (cron → download → ingest → schema → REST) — [analytics/api/docs/playstore-pipeline.md](api/docs/playstore-pipeline.md). Cron/env-only details — [analytics/api/docs/playstore-download-cron.md](api/docs/playstore-download-cron.md).

### 4. Start the API

```bash
cd analytics/api
bun install
bun run dev
# → http://localhost:4000 (or PORT from .env)
# → GET /health  (Apple + Play config flags)
```

### 5. Start the web dashboard

```bash
cd analytics/web
bun install
bun run dev
# → http://localhost:3007 (see package.json)
```

### 6. Login

Open the web URL and sign in with the credentials from `analytics/api/.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

---

## API endpoints

All `/api/*` routes require `Authorization: Bearer <token>` from `POST /auth/login`.

### App Store

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Issue JWT |
| GET | `/health` | Config / credential hints (Apple + Play blocks) |
| GET | `/api/appstore/apps` | List apps |
| GET | `/api/appstore/sales` | Downloads, units, proceeds (TSV-backed history) |
| GET | `/api/appstore/reviews` | Customer reviews |

**Example**

```http
GET /api/appstore/sales?startDate=2026-04-01&endDate=2026-04-30&frequency=DAILY
```

### Google Play (SQLite-backed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/playstore/overview` | Installs, uninstalls, top country, rating snapshot (date range) |
| GET | `/api/playstore/trend` | Daily install vs uninstall trend |
| GET | `/api/playstore/countries` | Top countries by installs |
| GET | `/api/playstore/reviews` | Play reviews (ingested from bulk CSVs) |
| GET | `/api/playstore/crashes/trend` | Daily crashes / ANRs (overview) |
| GET | `/api/playstore/crashes/devices` | Device-level crash rows (paginated) |
| GET | `/api/playstore/crashes/app-versions` | Crashes/ANRs by version code (aggregated range) |
| GET | `/api/playstore/crashes/os-versions` | Crashes/ANRs by Android OS label (aggregated range) |
| GET | `/api/playstore/crashes/dimension-trends` | Daily series for top OS + top builds (timing comparison) |

Query parameters generally use `startDate` / `endDate` as `YYYY-MM-DD` unless documented per route.

---

## Dashboard pages

| Page | Platform | Data source |
|------|----------|-------------|
| Overview | App Store | Sales & Trends, reviews summary |
| Reviews | App Store | App Store Connect reviews API |
| Play Store / Overview | Google Play | SQLite (installs, ratings, countries) |
| Play Store / Reviews | Google Play | SQLite (`play_review`) |
| Play Store / Crashes | Google Play | SQLite (crash overview, device/app/OS breakdowns) |

---

## Data notes

### Apple

- **Sales & Trends**: gzipped TSV from Apple; on the order of ~365 days of history.
- **Reviews**: API-backed, broad history.
- **Lag**: Often 1–2 days behind real time.
- **Privacy**: Apple may omit small cohorts (e.g. fewer than 5 users).

### Google Play (bulk CSVs)

- **Source**: Files in the Play-linked GCS bucket; optional **in-process cron** downloads then runs **ingest** into `data/analytics.db`.
- **Not real-time**: Bulk reports lag Play Console; month selection and dedupe are documented in [playstore-pipeline.md](api/docs/playstore-pipeline.md).
- **Crashes**: Counts and dimensions from bulk reports — not stack traces; OS vs app version are **separate** exports (no single joint OS×version matrix).

---

## Credential setup (one-time)

### App Store Connect API

1. App Store Connect → Users and Access → Integrations → App Store Connect API
2. Request access if needed
3. Team Keys → add key (role **Admin** is typical for analytics-style access)
4. Download `.p8` once; note Key ID and Issuer ID
5. `base64 -i AuthKey_XXX.p8` for `APPLE_PRIVATE_KEY_BASE64`

### Google Play bulk / GCS

1. Play Console: invite the **same** service account used in GCP with permission to **view app information and download bulk reports**
2. Ensure **Download reports** bucket id matches `PLAYSTORE_GCS_BUCKET`
3. Store JSON key path in `GOOGLE_APPLICATION_CREDENTIALS` (never commit the key)
