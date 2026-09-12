/**
 * Pulse — API Client
 * Typed fetch wrappers. Handles DuckDB response envelopes.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface Kpis {
  impressions: number;
  interactionRate: number;
  conversionRate: number;
  revenue: number;
  activeCampaigns: number;
  totalEvents: number;
  _queryMs?: number;
}

export interface TimeseriesPoint {
  timestamp: number;
  count: number;
}

export interface BreakdownItem {
  label: string;
  count: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface GeoItem {
  country: string;
  count: number;
  lat: number;
  lon: number;
  revenue: number;
}

export interface EngagementEvent {
  eventId: string;
  timestampMs: number;
  campaignId: string;
  campaignName: string;
  creativeType: string;
  eventType: string;
  deviceType: string;
  channel: string;
  country: string;
  lat: number;
  lon: number;
  sessionId: string;
  dwellMs: number;
  revenueUsd: number;
}

export interface EventsResponse {
  events: EngagementEvent[];
  total: number;
  nextCursor: number | null;
  _queryMs?: number;
}

export type Filters = {
  campaignId?: string;
  deviceType?: string;
  channel?: string;
  creativeType?: string;
  country?: string;
};

function buildQuery(params: Record<string, string | undefined>): string {
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (filtered.length === 0) return "";
  return "?" + new URLSearchParams(filtered as [string, string][]).toString();
}

export async function fetchKpis(filters?: Filters): Promise<Kpis> {
  const res = await fetch(`${API_BASE}/api/kpis${buildQuery(filters || {})}`);
  if (!res.ok) throw new Error(`KPIs: ${res.status}`);
  return res.json();
}

export async function fetchTimeseries(
  granularity: "minute" | "hour" | "day" = "day",
  filters?: Filters
): Promise<{ data: TimeseriesPoint[]; _queryMs: number; _points: number }> {
  const params = { granularity, ...filters };
  const res = await fetch(`${API_BASE}/api/timeseries${buildQuery(params)}`);
  if (!res.ok) throw new Error(`Timeseries: ${res.status}`);
  return res.json();
}

export async function fetchBreakdown(
  dimension: string = "deviceType",
  filters?: Filters
): Promise<BreakdownItem[]> {
  const params = { dimension, ...filters };
  const res = await fetch(`${API_BASE}/api/breakdown${buildQuery(params)}`);
  if (!res.ok) throw new Error(`Breakdown: ${res.status}`);
  const json = await res.json();
  return json.data; // unwrap DuckDB envelope
}

export async function fetchFunnel(filters?: Filters): Promise<FunnelStage[]> {
  const res = await fetch(`${API_BASE}/api/funnel${buildQuery(filters || {})}`);
  if (!res.ok) throw new Error(`Funnel: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchEvents(
  cursor: number = 0,
  limit: number = 50,
  search?: string,
  filters?: Filters
): Promise<EventsResponse> {
  const params = { cursor: String(cursor), limit: String(limit), search, ...filters };
  const res = await fetch(`${API_BASE}/api/events${buildQuery(params)}`);
  if (!res.ok) throw new Error(`Events: ${res.status}`);
  return res.json();
}

export async function fetchGeo(filters?: Filters): Promise<GeoItem[]> {
  const res = await fetch(`${API_BASE}/api/geo${buildQuery(filters || {})}`);
  if (!res.ok) throw new Error(`Geo: ${res.status}`);
  const json = await res.json();
  return json.data;
}
