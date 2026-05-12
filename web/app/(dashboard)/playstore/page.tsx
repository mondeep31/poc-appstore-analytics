"use client";

import { useCallback, useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import {
  api,
  type PlaystoreCountriesResponse,
  type PlaystoreOverviewResponse,
  type PlaystoreTrendResponse,
} from "@/lib/api";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { SectionHeader } from "@/components/dashboard/section-header";
import { DualAreaChart } from "@/components/charts/dual-area-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Globe2, UserMinus, Star, Activity, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function PlaystoreOverviewPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [overview, setOverview] = useState<PlaystoreOverviewResponse | null>(null);
  const [trend, setTrend] = useState<PlaystoreTrendResponse | null>(null);
  const [countries, setCountries] = useState<PlaystoreCountriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const start = format(dateRange.from, "yyyy-MM-dd");
  const end = format(dateRange.to, "yyyy-MM-dd");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [ov, tr, co] = await Promise.all([
        api.playstoreOverview({ startDate: start, endDate: end }),
        api.playstoreTrend({ startDate: start, endDate: end }),
        api.playstoreCountries({ startDate: start, endDate: end, limit: 10 }),
      ]);
      setOverview(ov);
      setTrend(tr);
      setCountries(co);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load Play Store data";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const topCountries = countries?.countries ?? [];
  const maxDl = topCountries[0]?.downloads ?? 1;

  return (
    <div className="px-6 py-6 space-y-6 max-w-[1400px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Play Store</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Google Play Console bulk reports (user installs / uninstalls by day)
          </p>
        </div>
      </div>

      {apiError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">API Error</p>
            <p className="text-xs text-muted-foreground mt-0.5">{apiError}</p>
          </div>
        </div>
      )}

      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={fetchAll}
        isLoading={loading}
        quickRangeEndOffsetDays={0}
        dataFreshnessNote={
          overview ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}` : undefined
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard
          title="User installs"
          value={overview?.totalInstalls?.toLocaleString() ?? "—"}
          subValue="SUM(daily_user_installs)"
          icon={Download}
          iconColor="text-primary"
          loading={loading}
        />
        <KpiCard
          title="User uninstalls"
          value={overview?.totalUninstalls?.toLocaleString() ?? "—"}
          subValue="SUM(daily_user_uninstalls)"
          icon={UserMinus}
          iconColor="text-orange-400"
          loading={loading}
        />
        <KpiCard
          title="Top country"
          value={overview?.topCountry ?? "—"}
          subValue={
            overview?.topCountry
              ? `${overview.topCountryDownloads.toLocaleString()} installs`
              : "No data in range"
          }
          icon={Globe2}
          iconColor="text-cyan-400"
          loading={loading}
        />
        <KpiCard
          title="Markets"
          value={overview?.countriesCount?.toLocaleString() ?? "0"}
          subValue="Countries with user installs in range"
          icon={Activity}
          iconColor="text-violet-400"
          loading={loading}
        />
        <KpiCard
          title="Avg rating"
          value={overview?.avgRating != null ? overview.avgRating.toFixed(2) : "—"}
          subValue="Latest cumulative total_avg_rating on or before range end"
          icon={Star}
          iconColor="text-amber-400"
          loading={loading}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          title="Installs vs uninstalls"
          description="Daily user installs and uninstalls (overview)"
        />
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : trend && trend.trend.length > 0 ? (
          <DualAreaChart
            data={trend.trend}
            xKey="date"
            yKeyA="installs"
            yKeyB="uninstalls"
            labelA="Installs"
            labelB="Uninstalls"
          />
        ) : (
          <div className="h-[220px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No trend data — run sync + ingest or widen date range</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader title="Top countries" description="By user installs (daily country breakdown)" />
        {loading ? (
          <div className="space-y-2.5 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : topCountries.length > 0 ? (
          <div className="space-y-2 pt-2">
            {topCountries.map((row) => (
              <div key={row.country} className="flex items-center gap-3">
                <span className="w-8 text-xs font-mono text-muted-foreground shrink-0">{row.country}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(row.downloads / maxDl) * 100}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums font-medium w-14 text-right">
                  {row.downloads.toLocaleString()}
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

      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 w-fit">
        <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Data comes from mirrored CSVs; cron runs download then SQLite ingest.
        </p>
      </div>
    </div>
  );
}
