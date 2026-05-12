"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import {
  api,
  type PlaystoreCrashesTrendResponse,
  type PlaystoreCrashesDevicesResponse,
  type PlaystoreCrashesAppVersionsResponse,
  type PlaystoreCrashesOsVersionsResponse,
  type PlaystoreCrashesDimensionTrendsResponse,
} from "@/lib/api";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { SectionHeader } from "@/components/dashboard/section-header";
import { DualAreaChart } from "@/components/charts/dual-area-chart";
import { CrashDimensionLineCharts } from "@/components/charts/crash-dimension-line-charts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Bug } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;
const AGG_LIMIT = 20;
const DIM_TOP_N = 5;

export default function PlaystoreCrashesPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [trend, setTrend] = useState<PlaystoreCrashesTrendResponse | null>(null);
  const [devices, setDevices] = useState<PlaystoreCrashesDevicesResponse | null>(null);
  const [appVersions, setAppVersions] = useState<PlaystoreCrashesAppVersionsResponse | null>(null);
  const [osVersions, setOsVersions] = useState<PlaystoreCrashesOsVersionsResponse | null>(null);
  const [dimensionTrends, setDimensionTrends] =
    useState<PlaystoreCrashesDimensionTrendsResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const start = format(dateRange.from, "yyyy-MM-dd");
  const end = format(dateRange.to, "yyyy-MM-dd");

  useEffect(() => {
    setOffset(0);
  }, [start, end]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [tr, dev, av, ov, dim] = await Promise.all([
        api.playstoreCrashesTrend({ startDate: start, endDate: end }),
        api.playstoreCrashesDevices({
          startDate: start,
          endDate: end,
          limit: PAGE_SIZE,
          offset,
        }),
        api.playstoreCrashesAppVersions({ startDate: start, endDate: end, limit: AGG_LIMIT }),
        api.playstoreCrashesOsVersions({ startDate: start, endDate: end, limit: AGG_LIMIT }),
        api.playstoreCrashesDimensionTrends({
          startDate: start,
          endDate: end,
          topN: DIM_TOP_N,
        }),
      ]);
      setTrend(tr);
      setDevices(dev);
      setAppVersions(av);
      setOsVersions(ov);
      setDimensionTrends(dim);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load crash data";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [start, end, offset]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const total = devices?.total ?? 0;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  const rows = devices?.rows ?? [];
  const byVersion = appVersions?.versions ?? [];
  const byOs = osVersions?.osVersions ?? [];
  const maxVerCrashes = Math.max(1, ...byVersion.map((r) => r.crashes));
  const maxOsCrashes = Math.max(1, ...byOs.map((r) => r.crashes));

  return (
    <div className="px-6 py-6 space-y-6 max-w-[1400px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bug className="h-5 w-5 text-emerald-500" />
            Play Store — Crashes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily crash and ANR counts from Play bulk reports. Device column is Play Console codename, not a stack
            trace.
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
          trend ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}` : undefined
        }
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          title="Crashes and ANRs"
          description="App-wide daily totals (overview report)"
        />
        {loading && !trend ? (
          <Skeleton className="h-[220px] w-full" />
        ) : trend && trend.trend.length > 0 ? (
          <DualAreaChart
            data={trend.trend}
            xKey="date"
            yKeyA="crashes"
            yKeyB="anrs"
            labelA="Crashes"
            labelB="ANRs"
            colorA="oklch(0.55 0.2 145)"
            colorB="oklch(0.62 0.18 55)"
          />
        ) : (
          <div className="h-[220px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No trend data — run ingest after syncing crash CSVs or widen the date range
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          title="OS vs build timing"
          description={
            dimensionTrends?.note ??
            "Compare daily crash counts for the top Android OS labels and top build codes. This is not a joint OS×build matrix—Play exports those dimensions separately."
          }
        />
        {loading && !dimensionTrends ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        ) : dimensionTrends &&
          (dimensionTrends.osTrends.length > 0 || dimensionTrends.appTrends.length > 0) ? (
          <CrashDimensionLineCharts
            osTrends={dimensionTrends.osTrends}
            appTrends={dimensionTrends.appTrends}
          />
        ) : (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            No dimension-level daily series in this range
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionHeader
            title="By app version (build)"
            description="Totals in range by version code (bulk app_version report)"
          />
          {loading && byVersion.length === 0 ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : byVersion.length > 0 ? (
            <div className="space-y-2 pt-2">
              {byVersion.map((row) => (
                <div key={row.appVersionCode} className="flex items-center gap-3">
                  <span className="w-14 text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                    v{row.appVersionCode}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/80 transition-all"
                      style={{ width: `${(row.crashes / maxVerCrashes) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs tabular-nums text-right shrink-0 w-28">
                    <span className="font-medium">{row.crashes.toLocaleString()}</span>
                    <span className="text-muted-foreground"> cr · </span>
                    <span>{row.anrs.toLocaleString()} ANR</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-28">
              <p className="text-sm text-muted-foreground">No app-version breakdown in this range</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <SectionHeader
            title="By Android OS"
            description="Totals in range by OS label from Play (bulk os_version report)"
          />
          {loading && byOs.length === 0 ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : byOs.length > 0 ? (
            <div className="space-y-2 pt-2">
              {byOs.map((row) => (
                <div key={row.osVersion} className="flex items-center gap-3">
                  <span className="w-28 text-xs font-medium truncate shrink-0" title={row.osVersion}>
                    {row.osVersion}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-0">
                    <div
                      className="h-full rounded-full bg-cyan-500/75 transition-all"
                      style={{ width: `${(row.crashes / maxOsCrashes) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs tabular-nums text-right shrink-0 w-28">
                    <span className="font-medium">{row.crashes.toLocaleString()}</span>
                    <span className="text-muted-foreground"> cr · </span>
                    <span>{row.anrs.toLocaleString()} ANR</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-28">
              <p className="text-sm text-muted-foreground">No OS breakdown in this range</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <SectionHeader
            title="By device"
            description="Per-device daily rows from the bulk device breakdown (sorted by date, then crash count)"
            className="mb-0"
          />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">
              {total === 0 ? "0 rows" : `${offset + 1}–${pageEnd} of ${total.toLocaleString()}`}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Device</th>
                  <th className="px-3 py-2 font-medium text-right">Crashes</th>
                  <th className="px-3 py-2 font-medium text-right">ANRs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.date}-${r.device}-${i}`}
                    className="border-b border-border/80 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {(() => {
                        try {
                          return format(parseISO(r.date), "MMM d, yyyy");
                        } catch {
                          return r.date;
                        }
                      })()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.device}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.crashes.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.anrs.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">No device-level rows in this range</p>
          </div>
        )}
      </div>
    </div>
  );
}
