import { ascFetch } from "./auth.ts";
import { gunzipSync } from "zlib";

export interface SalesRow {
  provider: string;
  providerCountry: string;
  sku: string;
  developer: string;
  title: string;
  version: string;
  productTypeIdentifier: string;
  units: number;
  developerProceeds: number;
  beginDate: string;
  endDate: string;
  customerCurrency: string;
  countryCode: string;
  currencyOfProceeds: string;
  appleIdentifier: string;
  customerPrice: number;
  device: string;
  orderType: string;
}

// Apple's column order in the SALES SUMMARY TSV as of 2024
const TSV_COLUMNS = [
  "provider",
  "providerCountry",
  "sku",
  "developer",
  "title",
  "version",
  "productTypeIdentifier",
  "units",
  "developerProceeds",
  "beginDate",
  "endDate",
  "customerCurrency",
  "countryCode",
  "currencyOfProceeds",
  "appleIdentifier",
  "customerPrice",
  "promoCode",
  "parentIdentifier",
  "subscription",
  "period",
  "category",
  "cmb",
  "device",
  "supportedPlatforms",
  "proceedsReason",
  "preservedPricing",
  "client",
  "orderType",
];

function parseTsv(content: string): SalesRow[] {
  const lines = content.split(/\r?\n/);

  // Find the header line (first non-empty line)
  const headerIdx = lines.findIndex((l) => l.trim().length > 0);
  if (headerIdx === -1) return [];

  const header = lines[headerIdx].split("\t").map((h) => h.trim().toLowerCase());
  const dataLines = lines.slice(headerIdx + 1);

  return dataLines
    .filter((l) => l.trim())
    .map((line) => {
      const values = line.split("\t");

      // Map by actual header when available, fall back to positional
      const get = (name: string, fallbackIdx: number): string => {
        const idx = header.indexOf(name.toLowerCase());
        if (idx !== -1) return values[idx] ?? "";
        return values[fallbackIdx] ?? "";
      };

      return {
        provider: get("provider", 0),
        providerCountry: get("provider country", 1),
        sku: get("sku", 2),
        developer: get("developer", 3),
        title: get("title", 4),
        version: get("version", 5),
        productTypeIdentifier: get("product type identifier", 6),
        units: parseFloat(get("units", 7)) || 0,
        developerProceeds: parseFloat(get("developer proceeds", 8)) || 0,
        beginDate: get("begin date", 9),
        endDate: get("end date", 10),
        customerCurrency: get("customer currency", 11),
        countryCode: get("country code", 12),
        currencyOfProceeds: get("currency of proceeds", 13),
        appleIdentifier: get("apple identifier", 14),
        customerPrice: parseFloat(get("customer price", 15)) || 0,
        device: get("device", 22),
        orderType: get("order type", 27),
      } as SalesRow;
    });
}

export type FetchStatus = "ok" | "no_data" | "error";

export interface FetchDayResult {
  date: string;
  status: FetchStatus;
  rowCount?: number;
  errorMessage?: string;
  httpStatus?: number;
}

export async function fetchSalesReport(
  vendorNumber: string,
  reportDate: string,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" = "DAILY"
): Promise<{ rows: SalesRow[]; status: FetchStatus; errorMessage?: string; httpStatus?: number }> {
  const params = new URLSearchParams({
    "filter[reportType]": "SALES",
    "filter[frequency]": frequency,
    "filter[reportDate]": reportDate,
    "filter[vendorNumber]": vendorNumber,
    "filter[reportSubType]": "SUMMARY",
  });

  const url = `https://api.appstoreconnect.apple.com/v1/salesReports?${params}`;

  let res: Response;
  try {
    res = await ascFetch(url);
  } catch (err) {
    return {
      rows: [],
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  // 404 = no data for that date (normal for future dates, holidays, etc.)
  if (res.status === 404) {
    return { rows: [], status: "no_data" };
  }

  // 400 with "no data" body is also common for dates with zero sales
  if (res.status === 400) {
    const text = await res.text().catch(() => "");
    if (text.toLowerCase().includes("no data") || text.toLowerCase().includes("not available")) {
      return { rows: [], status: "no_data" };
    }
    return { rows: [], status: "error", errorMessage: `400: ${text.slice(0, 200)}`, httpStatus: 400 };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      rows: [],
      status: "error",
      errorMessage: `HTTP ${res.status}: ${text.slice(0, 300)}`,
      httpStatus: res.status,
    };
  }

  try {
    const buffer = await res.arrayBuffer();
    const bytes = Buffer.from(buffer);

    // Try gzip decompression; fall back to raw text
    let content: string;
    try {
      content = gunzipSync(bytes).toString("utf-8");
    } catch {
      content = bytes.toString("utf-8");
    }

    const rows = parseTsv(content);
    return { rows, status: rows.length > 0 ? "ok" : "no_data" };
  } catch (err) {
    return {
      rows: [],
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Parse error",
    };
  }
}

export interface SalesAggregate {
  byDate: Record<string, { units: number; proceeds: number }>;
  byCountry: Record<string, { units: number; proceeds: number }>;
  byDevice: Record<string, { units: number; proceeds: number }>;
  byProductType: Record<string, { units: number; proceeds: number }>;
}

export function aggregateSales(rows: SalesRow[]): SalesAggregate {
  const byDate: Record<string, { units: number; proceeds: number }> = {};
  const byCountry: Record<string, { units: number; proceeds: number }> = {};
  const byDevice: Record<string, { units: number; proceeds: number }> = {};
  const byProductType: Record<string, { units: number; proceeds: number }> = {};

  for (const row of rows) {
    const date = row.beginDate || row.endDate || "";
    const country = row.countryCode || "Unknown";
    const device = normalizeDevice(row.device) || "Unknown";
    const productType = row.productTypeIdentifier || "Unknown";

    byDate[date] ??= { units: 0, proceeds: 0 };
    byDate[date].units += row.units;
    byDate[date].proceeds += row.developerProceeds;

    byCountry[country] ??= { units: 0, proceeds: 0 };
    byCountry[country].units += row.units;
    byCountry[country].proceeds += row.developerProceeds;

    byDevice[device] ??= { units: 0, proceeds: 0 };
    byDevice[device].units += row.units;
    byDevice[device].proceeds += row.developerProceeds;

    byProductType[productType] ??= { units: 0, proceeds: 0 };
    byProductType[productType].units += row.units;
    byProductType[productType].proceeds += row.developerProceeds;
  }

  return { byDate, byCountry, byDevice, byProductType };
}

// Normalize Apple device identifiers to human-readable labels
function normalizeDevice(raw: string): string {
  if (!raw) return "Unknown";
  const lower = raw.toLowerCase();
  if (lower === "iphone" || lower === "iphone/ipod touch") return "iPhone";
  if (lower === "ipad") return "iPad";
  if (lower === "desktop" || lower === "mac") return "Mac";
  if (lower === "apple tv") return "Apple TV";
  if (lower === "apple watch") return "Apple Watch";
  if (lower === "ipod touch") return "iPod Touch";
  // Title-case as fallback
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
