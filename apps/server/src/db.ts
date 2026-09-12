/**
 * Pulse — DuckDB Analytics Engine
 *
 * All queries execute against DuckDB's columnar engine.
 * Pre-materialized time-series tables for LOD queries.
 * SQL replaces Array.filter() — O(ms) at 1M+ rows.
 */

import duckdb from "duckdb";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../../../data/pulse.duckdb");

// ─── Types ───────────────────────────────────────────────────────
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

// ─── DuckDB Connection ──────────────────────────────────────────
let db: InstanceType<typeof duckdb.Database>;
let conn: any;
let totalEvents = 0;

function query(sql: string, ...params: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, ...params, (err: any, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export async function loadData(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.error("❌ No database found. Run `npm run seed` first.");
    process.exit(1);
  }

  console.log("  Loading DuckDB...");
  const t0 = performance.now();

  db = new duckdb.Database(DB_PATH, { access_mode: "READ_ONLY" });
  conn = db.connect();

  // Verify
  const [{ cnt }] = await query("SELECT COUNT(*) as cnt FROM events");
  totalEvents = Number(cnt);
  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  console.log(`  ✓ DuckDB ready — ${totalEvents.toLocaleString()} rows in ${elapsed}s`);

  // Warm up aggregation cache
  await query("SELECT COUNT(*) FROM agg_by_day");
  console.log("  ✓ Aggregation tables warm");
}

function buildWhere(filters?: Record<string, string | undefined>): { where: string; params: any[] } {
  if (!filters) return { where: "", params: [] };
  const clauses: string[] = [];
  const params: any[] = [];
  
  if (filters.campaignId) { clauses.push(`campaign_id = ?`); params.push(filters.campaignId); }
  if (filters.deviceType) { clauses.push(`device_type = ?`); params.push(filters.deviceType); }
  if (filters.channel) { clauses.push(`channel = ?`); params.push(filters.channel); }
  if (filters.creativeType) { clauses.push(`creative_type = ?`); params.push(filters.creativeType); }
  if (filters.country) { clauses.push(`country = ?`); params.push(filters.country); }
  
  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

// ─── Query Functions ─────────────────────────────────────────────

export async function getKpis(filters?: Record<string, string | undefined>) {
  const t0 = performance.now();
  const { where, params } = buildWhere(filters);

  const [row] = await query(`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
      COUNT(*) FILTER (WHERE event_type IN ('tap', 'swipe', 'voice_command')) as interactions,
      COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions,
      SUM(revenue_usd) as revenue,
      COUNT(DISTINCT campaign_id) as active_campaigns,
      COUNT(*) as total_events
    FROM events
    ${where}
  `, ...params);

  const elapsed = performance.now() - t0;
  const impressions = Number(row.impressions);
  const interactions = Number(row.interactions);
  const conversions = Number(row.conversions);

  return {
    impressions,
    interactionRate: impressions > 0 ? interactions / impressions : 0,
    conversionRate: impressions > 0 ? conversions / impressions : 0,
    revenue: Math.round(Number(row.revenue) * 100) / 100,
    activeCampaigns: Number(row.active_campaigns),
    totalEvents: Number(row.total_events),
    _queryMs: Math.round(elapsed),
  };
}

export async function getTimeseries(
  granularity: "minute" | "hour" | "day" = "day",
  filters?: Record<string, string | undefined>
) {
  const t0 = performance.now();
  const hasFilters = filters && Object.values(filters).some(Boolean);

  let rows: any[];

  if (!hasFilters) {
    // Use pre-materialized table — fastest path
    const table = `agg_by_${granularity}`;
    rows = await query(`SELECT bucket as timestamp, cnt as count FROM ${table} ORDER BY bucket`);
  } else {
    // Dynamic aggregation with filters
    const divisor = granularity === "day" ? 86400000 : granularity === "hour" ? 3600000 : 60000;
    const { where, params } = buildWhere(filters);
    rows = await query(`
      SELECT
        (timestamp_ms / ${divisor}) * ${divisor} as timestamp,
        COUNT(*) as count
      FROM events
      ${where}
      GROUP BY 1
      ORDER BY 1
    `, ...params);
  }

  const elapsed = performance.now() - t0;
  return {
    data: rows.map((r) => ({ timestamp: Number(r.timestamp), count: Number(r.count) })),
    _queryMs: Math.round(elapsed),
    _points: rows.length,
  };
}

export async function getBreakdown(
  dimension: string = "device_type",
  filters?: Record<string, string | undefined>
) {
  const t0 = performance.now();
  // Map frontend dimension names to DB column names
  const colMap: Record<string, string> = {
    deviceType: "device_type",
    channel: "channel",
    creativeType: "creative_type",
    campaignName: "campaign_name",
    country: "country",
  };
  const col = colMap[dimension] || dimension;
  const { where, params } = buildWhere(filters);

  const rows = await query(`
    SELECT ${col} as label, COUNT(*) as count
    FROM events
    ${where}
    GROUP BY ${col}
    ORDER BY count DESC
  `, ...params);

  const elapsed = performance.now() - t0;
  return {
    data: rows.map((r) => ({ label: r.label, count: Number(r.count) })),
    _queryMs: Math.round(elapsed),
  };
}

export async function getFunnel(filters?: Record<string, string | undefined>) {
  const t0 = performance.now();
  const { where, params } = buildWhere(filters);

  const [row] = await query(`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
      COUNT(*) FILTER (WHERE event_type = 'view') as views,
      COUNT(*) FILTER (WHERE event_type IN ('tap', 'swipe', 'voice_command')) as interactions,
      COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions
    FROM events
    ${where}
  `, ...params);

  const elapsed = performance.now() - t0;
  return {
    data: [
      { stage: "Impression", count: Number(row.impressions) },
      { stage: "View", count: Number(row.views) },
      { stage: "Interact", count: Number(row.interactions) },
      { stage: "Convert", count: Number(row.conversions) },
    ],
    _queryMs: Math.round(elapsed),
  };
}

export async function getEvents(
  cursor: number = 0,
  limit: number = 50,
  search?: string,
  filters?: Record<string, string | undefined>
) {
  const t0 = performance.now();
  const clauses: string[] = [];
  const params: any[] = [];

  // Apply filters
  if (filters?.campaignId) { clauses.push(`campaign_id = ?`); params.push(filters.campaignId); }
  if (filters?.deviceType) { clauses.push(`device_type = ?`); params.push(filters.deviceType); }
  if (filters?.channel) { clauses.push(`channel = ?`); params.push(filters.channel); }
  if (filters?.creativeType) { clauses.push(`creative_type = ?`); params.push(filters.creativeType); }
  if (filters?.country) { clauses.push(`country = ?`); params.push(filters.country); }

  // Search
  if (search) {
    clauses.push(`(
      campaign_name ILIKE ?
      OR event_type ILIKE ?
      OR country ILIKE ?
      OR event_id ILIKE ?
    )`);
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  // Count
  const [{ cnt }] = await query(`SELECT COUNT(*) as cnt FROM events ${where}`, ...params);
  const total = Number(cnt);

  // Fetch page
  const pageParams = [...params, limit, cursor];
  const rows = await query(`
    SELECT
      event_id, timestamp_ms, campaign_id, campaign_name,
      creative_type, event_type, device_type, channel,
      country, lat, lon, session_id, dwell_ms, revenue_usd
    FROM events
    ${where}
    ORDER BY timestamp_ms
    LIMIT ?
    OFFSET ?
  `, ...pageParams);

  const elapsed = performance.now() - t0;

  return {
    events: rows.map((r) => ({
      eventId: r.event_id,
      timestampMs: Number(r.timestamp_ms),
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      creativeType: r.creative_type,
      eventType: r.event_type,
      deviceType: r.device_type,
      channel: r.channel,
      country: r.country,
      lat: Number(r.lat),
      lon: Number(r.lon),
      sessionId: r.session_id,
      dwellMs: Number(r.dwell_ms),
      revenueUsd: Number(r.revenue_usd),
    })),
    total,
    nextCursor: cursor + limit < total ? cursor + limit : null,
    _queryMs: Math.round(elapsed),
  };
}

export async function getGeoData(filters?: Record<string, string | undefined>) {
  const t0 = performance.now();
  const { where, params } = buildWhere(filters);

  const rows = await query(`
    SELECT
      country,
      COUNT(*) as count,
      AVG(lat) as lat,
      AVG(lon) as lon,
      SUM(revenue_usd)::DECIMAL(12,2) as revenue
    FROM events
    ${where}
    GROUP BY country
    ORDER BY count DESC
  `, ...params);

  const elapsed = performance.now() - t0;
  return {
    data: rows.map((r) => ({
      country: r.country,
      count: Number(r.count),
      lat: Number(r.lat),
      lon: Number(r.lon),
      revenue: Number(r.revenue),
    })),
    _queryMs: Math.round(elapsed),
  };
}

// Live event: pick a random row and re-timestamp
export async function getRandomEvent(): Promise<EngagementEvent> {
  const offset = Math.floor(Math.random() * totalEvents);
  const [r] = await query(`
    SELECT * FROM events LIMIT 1 OFFSET ${offset}
  `);
  return {
    eventId: `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestampMs: Date.now(),
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    creativeType: r.creative_type,
    eventType: r.event_type,
    deviceType: r.device_type,
    channel: r.channel,
    country: r.country,
    lat: Number(r.lat),
    lon: Number(r.lon),
    sessionId: r.session_id,
    dwellMs: Number(r.dwell_ms),
    revenueUsd: Number(r.revenue_usd),
  };
}
