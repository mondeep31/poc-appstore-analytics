import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: { value: number; label: string };
  icon: LucideIcon;
  iconColor?: string;
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  title,
  value,
  subValue,
  trend,
  icon: Icon,
  iconColor = "text-primary",
  loading,
  className,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
        <div className="flex items-start justify-between mb-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 transition-colors hover:border-border/80",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted", iconColor.replace("text-", "bg-").replace("primary", "primary/10"))}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {trend && (
          <span
            className={cn(
              "mb-0.5 text-xs font-medium",
              trend.value >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value.toFixed(1)}%
          </span>
        )}
      </div>

      {subValue && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subValue}</p>
      )}
    </div>
  );
}
