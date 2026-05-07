"use client";

import { useEffect, useState, useCallback } from "react";
import { subDays, format } from "date-fns";
import { api, type ReviewsResponse, type SalesResponse } from "@/lib/api";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { SectionHeader } from "@/components/dashboard/section-header";
import { AreaChart } from "@/components/charts/area-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Globe2, Star, Activity, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface App {
  id: string;
  name: string;
  bundleId: string;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  "1": "App (iOS/iPadOS/visionOS/watchOS)",
  "1F": "App (Universal, excluding tvOS)",
  "1T": "App (iPad)",
  "1-B": "App Bundle",
  "1E": "Custom App (Paid iOS)",
  "1EP": "Custom App (Paid iPadOS)",
  "1EU": "Custom App (Paid Universal)",
  "3": "App Re-download",
  "7": "App Update",
  "7F": "App Update (Universal)",
  "F1": "Mac App",
  "F1-B": "Mac App Bundle",
  "F7": "Mac App Update",
  IA1: "In-App Purchase",
  "IA1-M": "In-App Purchase (Mac)",
  IA3: "Restored In-App Purchase",
  IA9: "Non-Renewing Subscription",
  IAY: "Auto-Renewable Subscription",
  "IAY-M": "Auto-Renewable Subscription (Mac)",
};

function productTypeLabel(code: string): string {
  return PRODUCT_TYPE_LABELS[code] ?? code;
}

export default function OverviewPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 9),
    to: subDays(new Date(), 2),
  });
  const [salesData, setSalesData] = useState<SalesResponse | null>(null);
  const [reviewData, setReviewData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [appsLoading, setAppsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    api.apps()
      .then((res) => {
        setApps(res.apps);
        if (res.apps[0]) setSelectedAppId(res.apps[0].id);
      })
      .catch((err) => {
        setApiError(err.message);
      })
      .finally(() => setAppsLoading(false));
  }, []);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const sales = await api.sales({
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      });
      setSalesData(sales);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const fetchReviews = useCallback(async () => {
    if (!selectedAppId) return;
    try {
      const res = await api.reviews({ appId: selectedAppId, limit: 200 });
      setReviewData(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load reviews";
      setApiError(msg);
      toast.error(msg);
    }
  }, [selectedAppId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // All sections use downloadsOnly (product type 1 — new installs only)
  const dl = salesData?.downloadsOnly;

  const trendData = dl
    ? Object.entries(dl.aggregate.byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, units: v.units }))
    : [];

  const deviceData = dl
    ? Object.entries(dl.aggregate.byDevice)
        .map(([name, v]) => ({ name, value: v.units }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  const totalDeviceUnits = deviceData.reduce((s, d) => s + d.value, 0);

  const topCountries = dl
    ? Object.entries(dl.aggregate.byCountry)
        .map(([country, v]) => ({ country, units: v.units }))
        .sort((a, b) => b.units - a.units)
        .slice(0, 8)
    : [];

  const maxCountryUnits = topCountries[0]?.units ?? 1;
  const topCountry = topCountries[0];

  return (
    <div className="px-6 py-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Apple App Store Connect — sales, downloads & reviews
          </p>
        </div>
      </div>

      {/* Config notice */}
      {apiError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">API Error</p>
            <p className="text-xs text-muted-foreground mt-0.5">{apiError}</p>
            {apiError.includes("credential") && (
              <p className="text-xs text-muted-foreground mt-1">
                Fill in Apple credentials in <code className="font-mono text-xs bg-muted px-1 rounded">analytics/api/.env</code>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Data freshness note */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 w-fit">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Apple data has a 1–2 day lag. Date range is auto-offset to account for this.
        </p>
      </div>

      {/* Filters */}
      <FilterBar
        apps={appsLoading ? undefined : apps}
        selectedAppId={selectedAppId}
        onAppChange={setSelectedAppId}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={fetchSales}
        isLoading={loading}
        dataFreshnessNote={salesData ? `Data through ${format(dateRange.to, "MMM d, yyyy")}` : undefined}
      />

      {/* KPI Cards — product type 1 only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="New Downloads"
          value={salesData?.downloadsOnly.totalUnits ?? 0}
          subValue="Product type 1 only"
          icon={Download}
          iconColor="text-primary"
          loading={loading}
        />
        <KpiCard
          title="Top Country"
          value={topCountry?.country ?? "—"}
          subValue={topCountry ? `${topCountry.units.toLocaleString()} downloads` : "No data in range"}
          icon={Globe2}
          iconColor="text-cyan-400"
          loading={loading}
        />
        <KpiCard
          title="Avg Rating"
          value={
            reviewData && reviewData.reviews.length > 0
              ? (
                  reviewData.reviews.reduce((sum, item) => sum + item.rating, 0) /
                  reviewData.reviews.length
                ).toFixed(2)
              : "—"
          }
          subValue={reviewData ? `${reviewData.totalCount} reviews` : "—"}
          icon={Star}
          iconColor="text-amber-400"
          loading={loading || appsLoading}
        />
        <KpiCard
          title="Markets"
          value={salesData ? Object.keys(salesData.downloadsOnly.aggregate.byCountry).length : 0}
          subValue="Countries with new installs"
          icon={Activity}
          iconColor="text-violet-400"
          loading={loading}
        />
      </div>

      {/* Downloads Trend — product type 1 only */}
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          title="Download Trend"
          description={`New installs (type 1) — ${format(dateRange.from, "MMM d")} to ${format(dateRange.to, "MMM d, yyyy")}`}
        />
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : trendData.length > 0 ? (
          <AreaChart data={trendData} xKey="date" yKey="units" />
        ) : (
          <div className="h-[220px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No data for selected range</p>
          </div>
        )}
      </div>

      {/* Device + Country split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Device */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionHeader title="By Device" description="New installs by device (type 1)" />
          {loading ? (
            <div className="space-y-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
            </div>
          ) : deviceData.length > 0 ? (
            <div className="space-y-3 pt-2">
              {deviceData.map((d, i) => {
                const colors = [
                  "oklch(0.58 0.22 250)",
                  "oklch(0.72 0.15 190)",
                  "oklch(0.68 0.17 155)",
                  "oklch(0.72 0.19 60)",
                  "oklch(0.62 0.22 10)",
                  "oklch(0.65 0.18 300)",
                  "oklch(0.70 0.16 30)",
                ];
                return (
                  <div key={d.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: colors[i % colors.length] }}
                        />
                        <span className="truncate text-muted-foreground">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="font-medium tabular-nums">{d.value.toLocaleString()}</span>
                        <span className="text-muted-foreground w-10 text-right">
                          {totalDeviceUnits > 0 ? ((d.value / totalDeviceUnits) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${totalDeviceUnits > 0 ? (d.value / deviceData[0].value) * 100 : 0}%`,
                          backgroundColor: colors[i % colors.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No device data</p>
            </div>
          )}
        </div>

        {/* Top Countries */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionHeader title="Top Markets" description="New installs by country (type 1)" />
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : topCountries.length > 0 ? (
            <div className="space-y-2">
              {topCountries.map((row) => (
                <div key={row.country} className="flex items-center gap-3">
                  <span className="w-8 text-xs font-mono text-muted-foreground shrink-0">{row.country}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(row.units / maxCountryUnits) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums font-medium w-14 text-right">
                    {row.units.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[180px]">
              <p className="text-sm text-muted-foreground">No country data</p>
            </div>
          )}
        </div>
      </div>

      {/* Product type breakdown */}
      {salesData && Object.keys(salesData.aggregate.byProductType).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionHeader title="Product Type Breakdown" description="Units and proceeds by App Store product type" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium text-muted-foreground">Product Type</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Units</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Proceeds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(salesData.aggregate.byProductType)
                  .sort(([, a], [, b]) => b.units - a.units)
                  .map(([type, v]) => (
                    <tr key={type}>
                      <td className="py-2 text-muted-foreground">{productTypeLabel(type)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{v.units.toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums text-emerald-400">${v.proceeds.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {salesData?.diagnostics?.errorDates && salesData.diagnostics.errorDates.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-amber-400">
              {salesData.diagnostics.errorDates.length} day(s) failed to fetch
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {salesData.diagnostics.errorDates.slice(0, 6).map((e) => (
                <span key={e.date} className="font-mono rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                  {e.date}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
