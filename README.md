# TradeSea App Store Analytics PoC

A full-stack analytics dashboard for Apple App Store Connect data.

## Stack
- **API**: Bun + Hono (port 4000)
- **Web**: Next.js 15 + shadcn/ui + Recharts (port 3000)
- **Auth**: JWT (HS256, 24h) — login: `admin` / `admin`

## Quick Start

### 1. Configure Apple credentials

```bash
cp analytics/api/.env.example analytics/api/.env
```

Edit `analytics/api/.env` and fill in:

```bash
APPLE_KEY_ID=          # From App Store Connect → Users and Access → Integrations → API Keys
APPLE_ISSUER_ID=       # From same page
APPLE_PRIVATE_KEY_BASE64=$(base64 -i ~/Downloads/AuthKey_XXXXX.p8)
APPLE_VENDOR_NUMBER=   # From Payments and Financial Reports
APPLE_APP_ID=          # Optional — auto-fetched from /v1/apps if blank
```

### 2. Start the API

```bash
cd analytics/api
bun install
bun run dev
# → http://localhost:4000
# → http://localhost:4000/health  (check credential status)
```

### 3. Start the web dashboard

```bash
cd analytics/web
bun install
bun run dev
# → http://localhost:3000
```

### 4. Login

Visit `http://localhost:3000` and sign in with `admin` / `admin`.

---

## API Endpoints

All `/api/*` endpoints require `Authorization: Bearer <token>` from `POST /auth/login`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Get JWT token |
| GET | `/health` | Check credential config |
| GET | `/api/appstore/apps` | List your apps |
| GET | `/api/appstore/sales` | Downloads, units, proceeds (365d history) |
| GET | `/api/appstore/reviews` | Customer reviews |

### Sales API example
```
GET /api/appstore/sales?startDate=2026-04-01&endDate=2026-04-30&frequency=DAILY
```

## Dashboard Pages

| Page | Data Source | History |
|------|-------------|---------|
| Overview | Sales & Trends + Reviews | 365 days |
| Reviews | Customer Reviews API | All time |

---

## Apple Data Notes

- **Sales & Trends**: Direct GET, instant response, gzipped TSV. ~365 days of history.
- **Reviews**: Near real-time, all historical reviews.
- **Data lag**: All data is 1–2 days behind real-time.
- **Privacy**: Apple omits rows with fewer than 5 users.

---

## Credential Setup (One-time)

1. Go to App Store Connect → Users and Access → Integrations → App Store Connect API
2. Request Access (if not done)
3. Team Keys → "+" → Role: **Admin** (Sales and Reports role alone won't work for Analytics)
4. Download `.p8` immediately (one-time download)
5. Note Key ID and Issuer ID
6. Base64 encode the key: `base64 -i AuthKey_XXX.p8`
