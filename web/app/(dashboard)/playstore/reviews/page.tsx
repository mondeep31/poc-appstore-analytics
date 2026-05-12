"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { api, type PlaystoreReviewRow } from "@/lib/api";
import { SectionHeader } from "@/components/dashboard/section-header";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, AlertCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted/40"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: PlaystoreReviewRow }) {
  const [expanded, setExpanded] = useState(false);
  const body = review.body ?? "";
  const isLong = body.length > 200;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-mono uppercase">
            {review.device?.slice(0, 3) ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-mono truncate">
              {review.device ?? "—"} · v{review.appVersionName ?? review.appVersionCode ?? "?"}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {review.rating != null && <StarRating rating={review.rating} />}
              {review.reviewerLanguage && (
                <span className="text-[10px] text-muted-foreground">{review.reviewerLanguage}</span>
              )}
            </div>
          </div>
        </div>
        {review.submittedAt && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {format(parseISO(review.submittedAt), "MMM d, yyyy")}
          </span>
        )}
      </div>
      {review.title && <p className="text-xs font-semibold">{review.title}</p>}
      {body && (
        <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded && isLong ? "line-clamp-3" : ""}`}>
          {body}
        </p>
      )}
      {isLong && (
        <button type="button" className="text-[10px] text-primary" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Less" : "More"}
        </button>
      )}
      {review.developerReplyText && (
        <div className="rounded-md bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Developer: </span>
          {review.developerReplyText}
        </div>
      )}
    </div>
  );
}

export default function PlaystoreReviewsPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 90),
    to: new Date(),
  });
  const [reviews, setReviews] = useState<PlaystoreReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const start = format(dateRange.from, "yyyy-MM-dd");
  const end = format(dateRange.to, "yyyy-MM-dd");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await api.playstoreReviews({
        startDate: start,
        endDate: end,
        limit: 200,
        offset: 0,
      });
      setReviews(res.reviews);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load reviews";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  return (
    <div className="px-6 py-6 space-y-6 max-w-[900px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Play Store reviews
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">From bulk-export review CSVs (ingested into SQLite)</p>
      </div>

      {apiError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{apiError}</p>
        </div>
      )}

      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={fetchReviews}
        isLoading={loading}
        quickRangeEndOffsetDays={0}
        dataFreshnessNote={total > 0 ? `${total} reviews in range` : undefined}
      />

      <SectionHeader title="All reviews" description="Newest first (up to 200 rows)" />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No reviews in this range</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
}
