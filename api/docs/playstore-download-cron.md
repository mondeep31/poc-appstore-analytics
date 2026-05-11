# Play Store bulk reports — scheduled download

Phase 1 tool: mirrors Play Console export objects from your linked **Google Cloud Storage** bucket to local disk and writes `manifest.json` + `inventory.json` for field discovery.

## Prerequisites

- Service account invited in Play Console with permission to **view app information and download bulk reports** (and bucket access via GCP).
- GCP APIs: typically your linked project already allows Storage access for that bucket.

## Troubleshooting

### 403 `storage.objects.list` / `does not have storage.objects.list access`

Google Cloud is rejecting list/download on the Play export bucket for the identity in `GOOGLE_APPLICATION_CREDENTIALS`.

1. **Same account everywhere** — The JSON key must be for the **exact** service account you invited in Play Console (check `client_email` in the JSON matches **Users and permissions**).
2. **Play Console permissions** — [Invite the service account](https://support.google.com/googleplay/android-developer/answer/6135870): **Users and permissions → Invite new users →** paste `…@….iam.gserviceaccount.com`. Enable **View app information and download bulk reports** (scope global + your app). Save — changes can take **up to 24 hours**.
3. **Linked Cloud project** — Play Console **Setup → API access** must link the GCP project where this service account was created.
4. **Bucket id** — `PLAYSTORE_GCS_BUCKET` must match **Play Console → Download reports** (bucket id only, no `gs://`). A typo can surface as permission errors.

GCP IAM roles on your own project do **not** replace Play’s bucket ACL for `pubsite_prod_*`; access is granted via Play Console as above.

## Environment variables

See [analytics/api/.env.example](../.env.example) — keys:

| Variable | Required | Description |
|----------|----------|-------------|
| `PLAYSTORE_GCS_BUCKET` | Yes | Bucket name only (no `gs://`). |
| `PLAYSTORE_PACKAGE_NAME` | Strongly recommended | Filters objects whose paths contain the package with `.` → `_`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | Path to service account JSON (same convention as Google client libraries). |
| `PLAYSTORE_RAW_DIR` | No | Defaults to `data/playstore/raw` under `analytics/api`. |

Prefixes fetched: `reviews/`, `stats/installs/`, `stats/ratings/`, `stats/store_performance/`, `stats/crashes/`.

## In-process schedule (node-schedule)

When the **analytics API** starts, [`node-schedule`](https://github.com/node-schedule/node-schedule) can register the GCS mirror job:

| Variable | Description |
|----------|-------------|
| `PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED` | Set to `true` / `1` / `yes` to enable. |
| `PLAYSTORE_DOWNLOAD_CRON` | Optional. Default `5 18 * * *` — **6:05 PM** wall clock in `PLAYSTORE_DOWNLOAD_TZ`. |
| `PLAYSTORE_DOWNLOAD_TZ` | Optional IANA zone. Default **`Asia/Kolkata`** (IST). The cron expression is always interpreted in this timezone. |

Requirements when enabled: `PLAYSTORE_GCS_BUCKET` and `GOOGLE_APPLICATION_CREDENTIALS`.

**Production note:** enable this on **one** API replica only; otherwise each instance will run the same job and duplicate GCS traffic.

Implementation: [analytics/api/src/playstore-scheduler.ts](../src/playstore-scheduler.ts) calls [runPlaystoreReportDownload](../src/services/playstore/download-reports.ts) on the schedule.

## OS Cron or manual one-off

Use this when you prefer **system cron** instead of the in-process scheduler (same env vars; run from `analytics/api` so `.env` loads):

```cron
# Example: cron host in UTC — 6:05 PM IST ≈ 12:35 UTC (IST = UTC+5:30)
35 12 * * * cd /absolute/path/to/tradesea/analytics/api && /absolute/path/to/bun -e "import { runPlaystoreReportDownload } from './src/services/playstore/download-reports.ts'; await runPlaystoreReportDownload();" >> /var/log/playstore-download.log 2>&1
```

Manual run from `analytics/api`:

```bash
bun -e "import { runPlaystoreReportDownload } from './src/services/playstore/download-reports.ts'; await runPlaystoreReportDownload();"
```

## Outputs

Inside `PLAYSTORE_RAW_DIR`:

- Mirrored objects preserving `object/name/path.csv`.
- `manifest.json` — last known `generation` / `md5Hash` / size per object; skips unchanged downloads.
- `inventory.json` — each file’s size and best-effort **first line** (CSV header) after UTF-16/UTF-8 sniff.

## Health check

`GET /health` includes `env.playstore.*`: bucket, package, credentials, raw dir, and whether the **in-process** download schedule is enabled plus resolved cron / timezone hints (no live GCS probe).
