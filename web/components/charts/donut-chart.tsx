"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface DonutChartProps {
  data: Array<{ name: string; value: number }>;
  colors?: string[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  formatValue?: (v: number) => string;
}

const DEFAULT_COLORS = [
  "oklch(0.58 0.22 250)",
  "oklch(0.72 0.15 190)",
  "oklch(0.68 0.17 155)",
  "oklch(0.72 0.19 60)",
  "oklch(0.62 0.22 10)",
  "oklch(0.65 0.18 300)",
  "oklch(0.70 0.16 30)",
];

function CustomTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; percent: number }>;
  formatValue?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-0.5">{item.name}</p>
      <p className="text-sm font-semibold tabular-nums">
        {formatValue ? formatValue(item.value) : item.value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">
        {(item.percent * 100).toFixed(1)}%
      </p>
    </div>
  );
}

export function DonutChart({
  data,
  colors = DEFAULT_COLORS,
  height = 220,
  innerRadius = 55,
  outerRadius = 85,
  formatValue,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-xl font-semibold tabular-nums">
          {formatValue ? formatValue(total) : total.toLocaleString()}
        </p>
        <p className="text-[10px] text-muted-foreground">Total</p>
      </div>
    </div>
  );
}
