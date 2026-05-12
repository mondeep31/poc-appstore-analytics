"use client";

import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

interface DualAreaChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKeyA: string;
  yKeyB: string;
  labelA?: string;
  labelB?: string;
  colorA?: string;
  colorB?: string;
  height?: number;
}

function DualTooltip({
  active,
  payload,
  label,
  labelA,
  labelB,
  yKeyA,
  yKeyB,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  labelA: string;
  labelB: string;
  yKeyA: string;
  yKeyB: string;
}) {
  if (!active || !payload?.length) return null;
  const a = payload.find((p) => p.dataKey === yKeyA);
  const b = payload.find((p) => p.dataKey === yKeyB);
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {a != null && (
        <p className="text-xs font-medium tabular-nums" style={{ color: a.color }}>
          {labelA}: {a.value.toLocaleString()}
        </p>
      )}
      {b != null && (
        <p className="text-xs font-medium tabular-nums" style={{ color: b.color }}>
          {labelB}: {b.value.toLocaleString()}
        </p>
      )}
    </div>
  );
}

export function DualAreaChart({
  data,
  xKey,
  yKeyA,
  yKeyB,
  labelA = "Installs",
  labelB = "Uninstalls",
  colorA = "oklch(0.58 0.22 250)",
  colorB = "oklch(0.62 0.22 10)",
  height = 220,
}: DualAreaChartProps) {
  const formatXAxis = (val: string) => {
    try {
      return format(parseISO(val), "MMM d");
    } catch {
      return val;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-installs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colorA} stopOpacity={0.2} />
            <stop offset="95%" stopColor={colorA} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="grad-uninstalls" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colorB} stopOpacity={0.2} />
            <stop offset="95%" stopColor={colorB} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickFormatter={formatXAxis}
          tick={{ fontSize: 11, fill: "oklch(0.58 0.008 240)" }}
          axisLine={false}
          tickLine={false}
          interval="equidistantPreserveStart"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "oklch(0.58 0.008 240)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip
          content={
            <DualTooltip
              labelA={labelA}
              labelB={labelB}
              yKeyA={yKeyA}
              yKeyB={yKeyB}
            />
          }
          cursor={{ stroke: "oklch(1 0 0 / 10%)", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey={yKeyA}
          name={labelA}
          stroke={colorA}
          strokeWidth={2}
          fill="url(#grad-installs)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey={yKeyB}
          name={labelB}
          stroke={colorB}
          strokeWidth={2}
          fill="url(#grad-uninstalls)"
          dot={false}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
