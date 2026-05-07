"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type CustomerReview, type ReviewsResponse } from "@/lib/api";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, RefreshCw, ChevronDown, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

const RATING_FILTER_OPTIONS = [
  { value: "all", label: "All Ratings" },
  { value: "5", label: "5 star" },
  { value: "4", label: "4 star" },
  { value: "3", label: "3 star" },
  { value: "2", label: "2 star" },
  { value: "1", label: "1 star" },
];

const SORT_OPTIONS = [
  { value: "-createdDate", label: "Newest first" },
  { value: "createdDate", label: "Oldest first" },
  { value: "-rating", label: "Highest rating" },
  { value: "rating", label: "Lowest rating" },
];

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted/40"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: CustomerReview }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.body.length > 200;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 hover:border-border/70 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
            {review.reviewerNickname?.[0] ?? "?"}
          </div>
          <div>
            <p className="text-xs font-medium">{review.reviewerNickname}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating rating={review.rating} />
              <span className="text-[10px] text-muted-foreground font-mono">{review.territory}</span>
            </div>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {review.createdDate
            ? format(parseISO(review.createdDate), "MMM d, yyyy")
            : ""}
        </span>
      </div>

      {review.title && (
        <p className="text-xs font-semibold">{review.title}</p>
      )}

      <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded && isLong ? "line-clamp-3" : ""}`}>
        {review.body}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const [appId, setAppId] = useState<string>("");
  const [apps, setApps] = useState<{ id: string; name: string }[]>([]);
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterRating, setFilterRating] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("-createdDate");
  const [cursor, setCursor] = useState<string | undefined>();
  const [allReviews, setAllReviews] = useState<CustomerReview[]>([]);
  const selectedRatingLabel =
    RATING_FILTER_OPTIONS.find((option) => option.value === filterRating)?.label ?? "All Ratings";
  const selectedSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? "Newest first";

  useEffect(() => {
    api.apps().then((res) => {
      setApps(res.apps);
      if (res.apps[0]) setAppId(res.apps[0].id);
    }).catch(() => {});
  }, []);

  const fetchReviews = useCallback(async (reset = true) => {
    if (!appId) return;
    setLoading(true);
    try {
      const res = await api.reviews({
        appId,
        limit: 50,
        sort: sortBy,
        filterRating: filterRating !== "all" ? parseInt(filterRating) : undefined,
        cursor: reset ? undefined : cursor,
      });
      setReviewsData(res);
      if (reset) {
        setAllReviews(res.reviews);
      } else {
        setAllReviews((prev) => [...prev, ...res.reviews]);
      }
      setCursor(res.nextCursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [appId, sortBy, filterRating, cursor]);

  useEffect(() => {
    if (appId) fetchReviews(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, sortBy, filterRating]);

  return (
    <div className="px-6 py-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reviews</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customer Reviews API — near real-time, all historical reviews
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {apps.length > 1 && (
          <Select value={appId} onValueChange={(v) => { if (v) setAppId(v); }}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Select app" />
            </SelectTrigger>
            <SelectContent>
              {apps.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filterRating} onValueChange={(v) => { if (v) setFilterRating(v); }}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue>{selectedRatingLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RATING_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => { if (v) setSortBy(v); }}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue>{selectedSortLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            fetchReviews(true);
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>

        {reviewsData && (
          <span className="text-xs text-muted-foreground ml-1">
            {reviewsData.totalCount.toLocaleString()} total reviews
          </span>
        )}
      </div>

      {/* Review feed */}
      <div>
        <SectionHeader
          title="Customer Reviews"
          description={`Showing ${allReviews.length} of ${reviewsData?.totalCount?.toLocaleString() ?? "—"} total`}
          action={
            filterRating !== "all" && (
              <Badge variant="secondary" className="text-xs">
                {filterRating}-star filter active
              </Badge>
            )
          }
        />

        {loading && allReviews.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : allReviews.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {allReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>

            {cursor && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchReviews(false)}
                  disabled={loading}
                  className="gap-1.5"
                >
                  {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                  Load more reviews
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No reviews found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try changing the rating filter or app selection
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
