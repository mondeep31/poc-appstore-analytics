"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

const PALETTE = [
  "oklch(0.58 0.2 250)",
  "oklch(0.6 0.18 145)",
  "oklch(0.62 0.2 55)",
  "oklch(0.55 0.2 310)",
  "oklch(0.58 0.15 200)",
  "oklch(0.65 0.16 25)",
  "oklch(0.52 0.12 240)",
  "oklch(0.6 0.22 130)",
];

type SeriesPoint = { date: string; crashes: number; anrs?: number };

function buildMerged(
  groups: Array<{ label: string; series: SeriesPoint[] }>,
  linePrefix: string,
): {
  chartData: Array<Record<string, string | number>>;
  lines: Array<{ dataKey: string; name: string; color: string }>;
} {
  const dates = new Set<string>();
  for (const g of groups) {
    for (const p of g.series) dates.add(p.date);
  }
  const sorted = [...dates].sort();
  const lines = groups.map((g, i) => ({
    dataKey: `${linePrefix}_${i}`,
    name: g.label,
    color: PALETTE[i % PALETTE.length]!,
  }));
  const chartData = sorted.map((date) => {
    const row: Record<string, string | number> = { date };
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!;
      const pt = g.series.find((s) => s.date === date);
      row[`${linePrefix}_${i}`] = pt?.crashes ?? 0;
    }
    return row;
  });
  return { chartData, lines };
}

interface CrashDimensionLineChartsProps {
  osTrends: Array<{ osVersion: string; series: SeriesPoint[] }>;
  appTrends: Array<{ appVersionCode: number; series: SeriesPoint[] }>;
  height?: number;
}

export function CrashDimensionLineCharts({
  osTrends,
  appTrends,
  height = 200,
}: CrashDimensionLineChartsProps) {
  const osGroups = osTrends.map((t) => ({ label: t.osVersion, series: t.series }));
  const appGroups = appTrends.map((t) => ({
    label: `Build ${t.appVersionCode}`,
    series: t.series,
  }));

  const mergedOs = buildMerged(osGroups, "os");
  const mergedApp = buildMerged(appGroups, "app");

  const formatX = (val: string) => {
    try {
      return format(parseISO(val), "MMM d");
    } catch {
      return val;
    }
  };

  const renderChart = (
    chartData: Array<Record<string, string | number>>,
    lines: Array<{ dataKey: string; name: string; color: string }>,
  ) => {
    if (chartData.length === 0 || lines.length === 0) {
      return (
        <div className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
          No series in range
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatX}
            tick={{ fontSize: 10, fill: "oklch(0.58 0.008 240)" }}
            axisLine={false}
            tickLine={false}
            interval="equidistantPreserveStart"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "oklch(0.58 0.008 240)" }}
            axisLine={false}
            tickLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: "1px solid oklch(1 0 0 / 12%)",
              background: "oklch(0.2 0.01 240)",
            }}
            labelFormatter={(d) => {
              try {
                return format(parseISO(String(d)), "MMM d, yyyy");
              } catch {
                return String(d);
              }
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {lines.map((ln) => (
            <Line
              key={ln.dataKey}
              type="monotone"
              dataKey={ln.dataKey}
              name={ln.name}
              stroke={ln.color}
              strokeWidth={1.75}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <p className="text-xs font-medium text-foreground mb-2">Daily crashes — top Android OS labels</p>
        {renderChart(mergedOs.chartData, mergedOs.lines)}
      </div>
      <div>
        <p className="text-xs font-medium text-foreground mb-2">Daily crashes — top version codes</p>
        {renderChart(mergedApp.chartData, mergedApp.lines)}
      </div>
    </div>
  );
}
