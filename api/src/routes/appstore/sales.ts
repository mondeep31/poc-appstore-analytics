import { Hono } from "hono";
import {
  fetchSalesReport,
  aggregateSales,
  type SalesRow,
  type FetchDayResult,
} from "../../services/apple/sales.ts";

const router = new Hono();

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");
  while (cur <= endDate) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// GET /api/appstore/sales?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&frequency=DAILY
router.get("/", async (c) => {
  const vendorNumber = process.env.APPLE_VENDOR_NUMBER;
  if (!vendorNumber) {
    return c.json({ error: "APPLE_VENDOR_NUMBER not configured" }, 500);
  }

  const startDate =
    c.req.query("startDate") ??
    new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const endDate =
    c.req.query("endDate") ??
    new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
  const frequency = (c.req.query("frequency") ?? "DAILY") as
    | "DAILY"
    | "WEEKLY"
    | "MONTHLY";

  const diffDays = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
  );
  if (diffDays > 365) {
    return c.json({ error: "Date range cannot exceed 365 days" }, 400);
  }

  const dates =
    frequency === "DAILY" ? dateRange(startDate, endDate) : [startDate];

  const allRows: SalesRow[] = [];
  const dayResults: FetchDayResult[] = [];

  // Fetch days concurrently, max 5 at a time to avoid rate limits
  const CHUNK = 5;
  for (let i = 0; i < dates.length; i += CHUNK) {
    const chunk = dates.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map((date) =>
        fetchSalesReport(vendorNumber, date, frequency).then((r) => ({
          date,
          ...r,
        })),
      ),
    );

    for (const r of results) {
      if (r.rows.length > 0) allRows.push(...r.rows);
      dayResults.push({
        date: r.date,
        status: r.status,
        rowCount: r.rows.length,
        errorMessage: r.errorMessage,
        httpStatus: r.httpStatus,
      });
    }
  }

  const aggregate = aggregateSales(allRows);

  // Product type 1 = new install (paid or free). Excludes type 3 (re-download) and 7 (update).
  const downloadRows = allRows.filter(
    (row) => row.productTypeIdentifier === "1",
  );
  const downloadAggregate = aggregateSales(downloadRows);
  const totalDownloads = downloadRows.reduce((s, r) => s + r.units, 0);

  const successfulDates = dayResults.filter((d) => d.status === "ok").length;
  const noDataDates = dayResults.filter((d) => d.status === "no_data").length;
  const errorDates = dayResults.filter((d) => d.status === "error");

  return c.json({
    startDate,
    endDate,
    frequency,
    // totalUnits includes all product types; use totalDownloads for new installs only
    totalUnits: allRows.reduce((s, r) => s + r.units, 0),
    totalProceeds: allRows.reduce((s, r) => s + r.developerProceeds, 0),
    totalDownloads,
    aggregate: {
      byDate: aggregate.byDate,
      byCountry: aggregate.byCountry,
      byDevice: aggregate.byDevice,
      byProductType: aggregate.byProductType,
    },
    downloadsOnly: {
      productTypeIdentifier: "1",
      totalUnits: totalDownloads,
      aggregate: {
        byDate: downloadAggregate.byDate,
        byCountry: downloadAggregate.byCountry,
        byDevice: downloadAggregate.byDevice,
      },
      rowCount: downloadRows.length,
    },
    rowCount: allRows.length,
    diagnostics: {
      totalDays: dates.length,
      successfulDates,
      noDataDates,
      errorDates: errorDates.map((d) => ({
        date: d.date,
        httpStatus: d.httpStatus,
        message: d.errorMessage,
      })),
    },
  });
});

export default router;
