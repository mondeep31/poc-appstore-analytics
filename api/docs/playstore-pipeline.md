# Google Play Store bulk pipeline (analytics API)

This document describes how Play Console bulk reports flow from **Google Cloud Storage (GCS)** → **local CSV mirror** → **SQLite** → **HTTP API** (and the **Next.js dashboard**). Source of truth is the code under `src/services/playstore/`, `src/routes/playstore/`, `src/db/`, and `src/playstore-scheduler.ts`.

For **cron env vars only**, see also [playstore-download-cron.md](./playstore-download-cron.md).

---

## High-level flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  API startup: startPlaystoreDownloadScheduler() (if enabled via env)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  node-schedule fires on PLAYSTORE_DOWNLOAD_CRON (+ optional TZ)            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. runPlaystoreReportDownload()                                         │
│     • Resolve which calendar months to sync (getMonthsToSync)            │
│     • Build GCS prefixes per month (gcsPrefixesForMonth)                 │
│     • Stream matching objects; skip unchanged via manifest.json          │
│     • Write under PLAYSTORE_RAW_DIR (default: data/playstore/raw)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. runPlaystoreIngest(rawDir, PLAYSTORE_PACKAGE_NAME)                   │
│     • Scan mirrored CSVs; decode UTF-8 / UTF-16 as needed                │
│     • UPSERT into data/analytics.db (Bun SQLite)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

There is **no separate “incremental ingest” flag**: every scheduled run **re-downloads** (skipping unchanged blobs) then **re-ingests** all matching CSVs. Ingest is **idempotent** (`INSERT OR REPLACE`).

---

## Scheduler (cron)

Registered in [`src/playstore-scheduler.ts`](../src/playstore-scheduler.ts), invoked once at API startup from [`src/index.ts`](../src/index.ts).

### When the in-process scheduler runs

| Condition | Behavior |
|-----------|----------|
| `PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED` not `true` / `1` / `yes` | Scheduler **not** registered; logs a hint. |
| `PLAYSTORE_GCS_BUCKET` missing | Scheduler **not** started. |
| `GOOGLE_APPLICATION_CREDENTIALS` missing or empty | Scheduler **not** started. |
| `PLAYSTORE_DOWNLOAD_CRON` missing | Scheduler **not** started (no default in code). |
| `PLAYSTORE_DOWNLOAD_TZ` missing | Cron uses **server local** timezone; a warning is logged. |

### What each tick does

`runScheduledDownload()` always runs **in order**:

1. `runPlaystoreReportDownload()`
2. `runPlaystoreIngest(playstoreRawDir(), playstorePackageName())`

If step 1 throws, step 2 does not run for that tick.

### Operational notes

- Run this on **one** API instance only, or every instance will duplicate GCS work.
- Manual re-run: from `analytics/api`, call download + ingest (with env loaded) — see [playstore-download-cron.md](./playstore-download-cron.md) for examples.

---

## GCS download: which months and prefixes

Logic lives in [`src/services/playstore/months.ts`](../src/services/playstore/months.ts) and [`src/services/playstore/download-reports.ts`](../src/services/playstore/download-reports.ts).

### `PLAYSTORE_PACKAGE_NAME` set (normal case)

1. **`getMonthsToSync(rawBase, packageName)`** returns a sorted list of `YYYYMM` strings:

   | Rule | Description |
   |------|-------------|
   | **Current month** | Always included (`YYYYMM` from server ** local** `Date`). |
   | **Previous month** | Included if **local calendar day ≤ 4** (grace window for late Play writes into the prior month). |
   | **Bootstrap / backfill** | Starting at the current month, walk **backward** up to **12** steps. For each month, if **`stats/installs/installs_<package>_<YYYYMM>_overview.csv`** does **not** exist under `rawBase`, add that month to the set. **Stop** as soon as that overview file **exists** (first “we already have this month” anchor). |

   The bootstrap set is **unioned** with the current-month (and optional previous-month) rule, then sorted.

2. **`gcsPrefixesForMonth(packageName, yyyyMm)`** expands each month into **six** GCS prefix strings (objects are listed under these prefixes; package id uses **dots**, matching Play paths):

   | Area | Prefix pattern |
   |------|----------------|
   | Reviews | `reviews/reviews_<pkg>_<YYYYMM>` |
   | Installs | `stats/installs/installs_<pkg>_<YYYYMM>_` |
   | Ratings | `stats/ratings/ratings_<pkg>_<YYYYMM>_` |
   | Store performance | `stats/store_performance/store_performance_<pkg>_<YYYYMM>_` |
   | Store performance (total) | `stats/store_performance/total_store_performance_<pkg>_<YYYYMM>_` |
   | Crashes | `stats/crashes/crashes_<pkg>_<YYYYMM>_` |

   The download step **flattens** all months → many prefixes, then streams all objects matching those prefixes.

### `PLAYSTORE_PACKAGE_NAME` unset (fallback)

[`download-reports.ts`](../src/services/playstore/download-reports.ts) logs a warning and uses **top-level** prefixes from [`constants.ts`](../src/services/playstore/constants.ts):

- `reviews/`, `stats/installs/`, `stats/ratings/`, `stats/store_performance/`, `stats/crashes/`

That mode can pull **all apps / all months** visible in the bucket — avoid in production unless intended.

### Deduping downloads (`manifest.json`)

Under the raw dir (default `data/playstore/raw/manifest.json`), each object path maps to last known **generation**, **md5Hash**, **size**, and download time. If GCS metadata matches, the file is **skipped** (no re-download). The manifest is updated **after each successful** download.

---

## Local paths and environment

| Variable | Role |
|----------|------|
| `PLAYSTORE_GCS_BUCKET` | Bucket id only (no `gs://`). **Required** for download. |
| `PLAYSTORE_PACKAGE_NAME` | e.g. `ai.tradesea.app`. **Strongly recommended**; drives month-scoped prefixes and ingest filters. |
| `PLAYSTORE_RAW_DIR` | Override mirror root. Default: `<cwd>/data/playstore/raw`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON (GCS access + Play-linked account). |

SQLite database path is **fixed** in code: `<cwd>/data/analytics.db` (see [`src/db/index.ts`](../src/db/index.ts)). WAL mode + `schema.sql` applied on first open.

---

## Ingest (`runPlaystoreIngest`)

Implementation: [`src/services/playstore/ingest-csv.ts`](../src/services/playstore/ingest-csv.ts).

- **No-op** if `PLAYSTORE_PACKAGE_NAME` is unset (warning logged).
- **App id**: single-app model uses `DEFAULT_APP_ID = 1` ([`src/db/index.ts`](../src/db/index.ts)).
- **Encoding**: Play CSVs are often **UTF-16 LE**; ingest normalizes to text before parsing.
- **Transactions**: one transaction **per file** for speed.
- **Reviews**: parsed with `csv-parse` (multiline bodies); stats rows use line split + comma columns where safe.

### CSV globs → tables (only files whose basename matches the configured package)

| Glob / filter | SQLite table |
|---------------|--------------|
| `stats/installs/*_overview.csv` | `play_installs_overview_daily` |
| `stats/installs/*_country.csv` | `play_installs_country_daily` |
| `stats/ratings/*_overview.csv` | `play_ratings_overview_daily` |
| `reviews/reviews_*.csv` | `play_review` |
| `stats/crashes/*_overview.csv` | `play_crashes_overview_daily` |
| `stats/crashes/*_device.csv` | `play_crashes_device_daily` |
| `stats/crashes/*_app_version.csv` | `play_crashes_app_version_daily` |
| `stats/crashes/*_os_version.csv` | `play_crashes_os_version_daily` |

**Not ingested** (still downloaded): store-performance CSVs, non-overview install/ratings breakdowns (e.g. `*_device.csv` for installs), etc.

**Re-ingest / backfill**: safe to run anytime; `INSERT OR REPLACE` overwrites by primary key. After adding new tables or raw files, run ingest again.

---

## SQLite schema (Play-related)

Defined in [`src/db/schema.sql`](../src/db/schema.sql). All Play tables use `app_id` with default `1`.

| Table | Primary key | Purpose |
|-------|-------------|---------|
| `play_installs_overview_daily` | `(app_id, date)` | Daily install/uninstall metrics (overview). |
| `play_installs_country_daily` | `(app_id, date, country)` | Daily installs/uninstalls by country. |
| `play_ratings_overview_daily` | `(app_id, date)` | Daily / total average rating (overview). |
| `play_review` | `review_id` | Individual reviews (+ index on `(app_id, submitted_at)`). |
| `play_crashes_overview_daily` | `(app_id, date)` | Daily app-wide crashes + ANRs. |
| `play_crashes_device_daily` | `(app_id, date, device)` | Daily crashes/ANRs by device codename. |
| `play_crashes_app_version_daily` | `(app_id, date, app_version_code)` | Daily crashes/ANRs by version code. |
| `play_crashes_os_version_daily` | `(app_id, date, os_version)` | Daily crashes/ANRs by Android OS label. |

---

## HTTP API (`/api/playstore/*`)

All routes sit under the main Hono app with **JWT** (`authMiddleware` on `/api/*`). Mount: [`src/routes/playstore/index.ts`](../src/routes/playstore/index.ts).

| Method & path | Description |
|---------------|-------------|
| `GET /api/playstore/overview` | Aggregates installs, uninstalls, top country, rating snapshot, country count (date range). |
| `GET /api/playstore/trend` | Daily installs vs uninstalls (overview). |
| `GET /api/playstore/countries` | Top countries by installs (date range). |
| `GET /api/playstore/reviews` | Paginated reviews (date range on `submitted_at`). |
| `GET /api/playstore/crashes/trend` | Daily crashes + ANRs (overview table). |
| `GET /api/playstore/crashes/devices` | Paginated device-level crash rows. |
| `GET /api/playstore/crashes/app-versions` | Aggregated crashes/ANRs by version code (range). |
| `GET /api/playstore/crashes/os-versions` | Aggregated crashes/ANRs by OS label (range). |
| `GET /api/playstore/crashes/dimension-trends` | Daily series for top-N OS + top-N build codes (timing comparison; not a joint OS×build matrix). |

Query parameters use **ISO dates** `YYYY-MM-DD` unless noted in route code (see individual files under `src/routes/playstore/`).

---

## Dashboard (Next.js)

Under `analytics/web/` (not in this package, but consumers of the API):

- Play Store overview, reviews, crashes pages call `lib/api.ts` helpers matching the routes above.
- Crashes UI documents Play bulk limitations where relevant (e.g. no stack traces; OS vs app version are **separate** reports).

---

## Git / secrets

Typical ignores (see [`../.gitignore`](../.gitignore)):

- `data/playstore/` (mirrored CSVs + manifest)
- `data/analytics.db` (+ `-wal`, `-shm`)
- `.env`, service account JSON

Do **not** commit bucket credentials or production manifests if they embed sensitive paths.

---

## File index (implementation map)

| Concern | Location |
|---------|----------|
| Cron registration | `src/playstore-scheduler.ts` |
| Month selection + GCS prefixes | `src/services/playstore/months.ts` |
| Download + manifest | `src/services/playstore/download-reports.ts`, `gcs.ts`, `manifest.ts` |
| Ingest | `src/services/playstore/ingest-csv.ts`, `text-decode.ts` |
| DB bootstrap | `src/db/index.ts`, `src/db/schema.sql` |
| REST handlers | `src/routes/playstore/*.ts` |
| Health / env introspection | `GET /health` in `src/index.ts` |
