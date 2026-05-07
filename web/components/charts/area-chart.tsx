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

interface AreaChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  yLabel?: string;
  color?: string;
  formatValue?: (v: number) => string;
  height?: number;
}

function CustomTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  formatValue?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {formatValue ? formatValue(val) : val.toLocaleString()}
      </p>
    </div>
  );
}

export function AreaChart({
  data,
  xKey,
  yKey,
  color = "oklch(0.58 0.22 250)",
  formatValue,
  height = 220,
}: AreaChartProps) {
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
          <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
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
          content={<CustomTooltip formatValue={formatValue} />}
          cursor={{ stroke: "oklch(1 0 0 / 10%)", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${yKey})`}
          dot={false}
          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
