import { ascFetch } from "./auth.ts";

export interface CustomerReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  reviewerNickname: string;
  createdDate: string;
  territory: string;
}

export interface ReviewsResponse {
  reviews: CustomerReview[];
  totalCount: number;
  nextCursor?: string;
}

export async function fetchCustomerReviews(
  appId: string,
  options: {
    limit?: number;
    sort?: string;
    cursor?: string;
    filterRating?: number;
    filterTerritory?: string;
  } = {}
): Promise<ReviewsResponse> {
  const { limit = 50, sort = "-createdDate", cursor, filterRating, filterTerritory } =
    options;

  const params = new URLSearchParams({
    sort,
    limit: String(limit),
  });

  if (cursor) params.set("cursor", cursor);
  if (filterRating) params.set("filter[rating]", String(filterRating));
  if (filterTerritory) params.set("filter[territory]", filterTerritory);

  const url = `https://api.appstoreconnect.apple.com/v1/apps/${appId}/customerReviews?${params}`;
  const res = await ascFetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apple Reviews API error ${res.status}: ${text}`);
  }

  const json = await res.json() as {
    data: Array<{
      id: string;
      attributes: {
        rating: number;
        title: string;
        body: string;
        reviewerNickname: string;
        createdDate: string;
        territory: string;
      };
    }>;
    meta?: {
      paging?: {
        total: number;
        nextCursor?: string;
      };
    };
  };

  const reviews: CustomerReview[] = (json.data ?? []).map((item) => ({
    id: item.id,
    rating: item.attributes?.rating ?? 0,
    title: item.attributes?.title ?? "",
    body: item.attributes?.body ?? "",
    reviewerNickname: item.attributes?.reviewerNickname ?? "Anonymous",
    createdDate: item.attributes?.createdDate ?? "",
    territory: item.attributes?.territory ?? "",
  }));

  return {
    reviews,
    totalCount: json.meta?.paging?.total ?? reviews.length,
    nextCursor: json.meta?.paging?.nextCursor,
  };
}
