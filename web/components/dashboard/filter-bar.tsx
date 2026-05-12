"use client";

import { useState, useEffect } from "react";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { format, subDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface App {
  id: string;
  name: string;
  bundleId: string;
}

interface FilterBarProps {
  apps?: App[];
  selectedAppId?: string;
  onAppChange?: (appId: string) => void;
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  dataFreshnessNote?: string;
  /** Days to subtract from "today" for the end of quick-pick ranges (Apple sales lag ~2d). Use 0 for Play Store. */
  quickRangeEndOffsetDays?: number;
}

const QUICK_RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export function FilterBar({
  apps,
  selectedAppId,
  onAppChange,
  dateRange,
  onDateRangeChange,
  onRefresh,
  isLoading,
  dataFreshnessNote,
  quickRangeEndOffsetDays = 2,
}: FilterBarProps) {
  const [calOpen, setCalOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({
    from: dateRange.from,
    to: dateRange.to,
  });

  useEffect(() => {
    setRange({ from: dateRange.from, to: dateRange.to });
  }, [dateRange]);

  function handleRangeSelect(r: DateRange | undefined) {
    if (!r) return;
    setRange(r);
    if (r.from && r.to) {
      onDateRangeChange({ from: r.from, to: r.to });
      setCalOpen(false);
    }
  }

  function handleQuickRange(days: number) {
    const to = subDays(new Date(), quickRangeEndOffsetDays);
    const from = subDays(to, days - 1);
    onDateRangeChange({ from, to });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* App selector */}
      {apps && apps.length > 0 && onAppChange && (
        <Select value={selectedAppId} onValueChange={(v) => { if (v) onAppChange(v); }}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="Select app" />
          </SelectTrigger>
          <SelectContent>
            {apps.map((app) => (
              <SelectItem key={app.id} value={app.id} className="text-xs">
                <span className="truncate">{app.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Quick ranges */}
      <div className="flex items-center gap-1">
        {QUICK_RANGES.map((q) => (
          <button
            key={q.days}
            onClick={() => handleQuickRange(q.days)}
            className="h-8 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Date range picker */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-xs font-normal transition-colors hover:bg-accent hover:text-accent-foreground",
            !range && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {range?.from ? (
            range.to ? (
              <>
                {format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}
              </>
            ) : (
              format(range.from, "MMM d, yyyy")
            )
          ) : (
            "Pick date range"
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
          />
        </PopoverContent>
      </Popover>

      {/* Refresh */}
      {onRefresh && (
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </button>
      )}

      {/* Freshness note */}
      {dataFreshnessNote && (
        <span className="text-[11px] text-muted-foreground/70 ml-1">
          {dataFreshnessNote}
        </span>
      )}
    </div>
  );
}
