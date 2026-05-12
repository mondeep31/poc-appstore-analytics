import { getToken, clearAuth } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const inFlightGetRequests = new Map<string, Promise<unknown>>();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const dedupeKey = method === "GET" ? `${method}:${url}:${token ?? ""}` : null;
  const existingRequest = dedupeKey ? inFlightGetRequests.get(dedupeKey) : null;
  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  const runRequest = async () => {
    const res = await fetch(url, { ...options, method, headers });

    if (res.status === 401) {
      clearAuth();
      window.location.href = "/login";
      throw new ApiError(401, "Session expired");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new ApiError(res.status, body.error ?? res.statusText);
    }

    return res.json() as Promise<T>;
  };

  if (!dedupeKey) {
    return runRequest();
  }

  const pendingRequest = runRequest().finally(() => {
    inFlightGetRequests.delete(dedupeKey);
  });
  inFlightGetRequests.set(dedupeKey, pendingRequest);
  return pendingRequest as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: { username: string; role: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  health: () => request<{ status: string; env: Record<string, unknown> }>("/health"),

  apps: () =>
    request<{ apps: Array<{ id: string; name: string; bundleId: string }> }>(
      "/api/appstore/apps"
    ),

  sales: (params: {
    startDate: string;
    endDate: string;
    frequency?: "DAILY" | "WEEKLY" | "MONTHLY";
  }) => {
    const q = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
      frequency: params.frequency ?? "DAILY",
    });
    return request<SalesResponse>(`/api/appstore/sales?${q}`);
  },

  reviews: (params: {
    appId?: string;
    limit?: number;
    sort?: string;
    filterRating?: number;
    cursor?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.appId) q.set("appId", params.appId);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.sort) q.set("sort", params.sort);
    if (params.filterRating) q.set("filterRating", String(params.filterRating));
    if (params.cursor) q.set("cursor", params.cursor);
    return request<ReviewsResponse>(`/api/appstore/reviews?${q}`);
  },

  playstoreOverview: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return request<PlaystoreOverviewResponse>(`/api/playstore/overview?${q}`);
  },

  playstoreTrend: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return request<PlaystoreTrendResponse>(`/api/playstore/trend?${q}`);
  },

  playstoreCountries: (params: { startDate: string; endDate: string; limit?: number }) => {
    const q = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.limit != null) q.set("limit", String(params.limit));
    return request<PlaystoreCountriesResponse>(`/api/playstore/countries?${q}`);
  },

  playstoreReviews: (params: {
    startDate: string;
    endDate: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    return request<PlaystoreReviewsResponse>(`/api/playstore/reviews?${q}`);
  },

  playstoreCrashesTrend: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return request<PlaystoreCrashesTrendResponse>(`/api/playstore/crashes/trend?${q}`);
  },

  playstoreCrashesDevices: (params: {
    startDate: string;
    endDate: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    return request<PlaystoreCrashesDevicesResponse>(`/api/playstore/crashes/devices?${q}`);
  },

  playstoreCrashesAppVersions: (params: {
    startDate: string;
    endDate: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.limit != null) q.set("limit", String(params.limit));
    return request<PlaystoreCrashesAppVersionsResponse>(`/api/playstore/crashes/app-versions?${q}`);
  },

  playstoreCrashesOsVersions: (params: {
    startDate: string;
    endDate: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.limit != null) q.set("limit", String(params.limit));
    return request<PlaystoreCrashesOsVersionsResponse>(`/api/playstore/crashes/os-versions?${q}`);
  },

  playstoreCrashesDimensionTrends: (params: {
    startDate: string;
    endDate: string;
    topN?: number;
  }) => {
    const q = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.topN != null) q.set("topN", String(params.topN));
    return request<PlaystoreCrashesDimensionTrendsResponse>(
      `/api/playstore/crashes/dimension-trends?${q}`,
    );
  },
};

export interface SalesResponse {
  startDate: string;
  endDate: string;
  frequency: string;
  totalUnits: number;
  totalProceeds: number;
  /** New installs only (product type 1). Use this for all download-related UI. */
  totalDownloads: number;
  aggregate: {
    byDate: Record<string, { units: number; proceeds: number }>;
    byCountry: Record<string, { units: number; proceeds: number }>;
    byDevice: Record<string, { units: number; proceeds: number }>;
    byProductType: Record<string, { units: number; proceeds: number }>;
  };
  /** Product type 1 only — new installs, excludes re-downloads (3) and updates (7). */
  downloadsOnly: {
    productTypeIdentifier: "1";
    totalUnits: number;
    aggregate: {
      byDate: Record<string, { units: number; proceeds: number }>;
      byCountry: Record<string, { units: number; proceeds: number }>;
      byDevice: Record<string, { units: number; proceeds: number }>;
    };
    rowCount: number;
  };
  rowCount: number;
  diagnostics?: {
    totalDays: number;
    successfulDates: number;
    noDataDates: number;
    errorDates: Array<{ date: string; httpStatus?: number; message?: string }>;
  };
}

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

export interface PlaystoreOverviewResponse {
  startDate: string;
  endDate: string;
  totalInstalls: number;
  totalUninstalls: number;
  topCountry: string | null;
  topCountryDownloads: number;
  avgRating: number | null;
  countriesCount: number;
}

export interface PlaystoreTrendResponse {
  startDate: string;
  endDate: string;
  trend: Array<{ date: string; installs: number; uninstalls: number }>;
}

export interface PlaystoreCountriesResponse {
  startDate: string;
  endDate: string;
  countries: Array<{ country: string; downloads: number }>;
}

export interface PlaystoreReviewRow {
  id: string;
  appVersionCode: number | null;
  appVersionName: string | null;
  reviewerLanguage: string | null;
  device: string | null;
  submittedAt: string | null;
  lastUpdatedAt: string | null;
  rating: number | null;
  title: string;
  body: string;
  developerRepliedAt: string | null;
  developerReplyText: string | null;
  reviewLink: string | null;
}

export interface PlaystoreReviewsResponse {
  startDate: string;
  endDate: string;
  total: number;
  reviews: PlaystoreReviewRow[];
}

export interface PlaystoreCrashesTrendResponse {
  startDate: string;
  endDate: string;
  trend: Array<{ date: string; crashes: number; anrs: number }>;
}

export interface PlaystoreCrashesDevicesResponse {
  startDate: string;
  endDate: string;
  limit: number;
  offset: number;
  total: number;
  rows: Array<{ date: string; device: string; crashes: number; anrs: number }>;
}

export interface PlaystoreCrashesAppVersionsResponse {
  startDate: string;
  endDate: string;
  limit: number;
  versions: Array<{ appVersionCode: number; crashes: number; anrs: number }>;
}

export interface PlaystoreCrashesOsVersionsResponse {
  startDate: string;
  endDate: string;
  limit: number;
  osVersions: Array<{ osVersion: string; crashes: number; anrs: number }>;
}

export interface PlaystoreCrashesDimensionTrendsResponse {
  startDate: string;
  endDate: string;
  topN: number;
  note: string;
  osTrends: Array<{
    osVersion: string;
    series: Array<{ date: string; crashes: number; anrs: number }>;
  }>;
  appTrends: Array<{
    appVersionCode: number;
    series: Array<{ date: string; crashes: number; anrs: number }>;
  }>;
}
