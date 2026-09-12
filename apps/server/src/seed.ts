/**
 * Pulse — Data Generator (Industry-Grade)
 *
 * Generates 1M+ engagement events with realistic statistical distributions,
 * inserts into DuckDB, and exports to Parquet for columnar analytics.
 *
 * Run: npx tsx src/seed.ts
 */

import duckdb from "duckdb";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");
const DB_PATH = resolve(DATA_DIR, "pulse.duckdb");
const PARQUET_PATH = resolve(DATA_DIR, "events.parquet");

// ─── Configuration ───────────────────────────────────────────────
const TOTAL_EVENTS = 1_000_000;
const DAYS = 90;
const START_DATE = new Date("2025-06-01T00:00:00Z").getTime();
const MS_PER_DAY = 86_400_000;
const BATCH_SIZE = 50_000; // Insert in batches for DuckDB efficiency

// ─── Enums ───────────────────────────────────────────────────────
const CAMPAIGNS = [
  { id: "camp-001", name: "Summer Blaze AR" },
  { id: "camp-002", name: "Holiday Interactive" },
  { id: "camp-003", name: "Spring Launch Video" },
  { id: "camp-004", name: "Brand Awareness QR" },
  { id: "camp-005", name: "Festive Commerce 360" },
];

const CREATIVE_TYPES = ["video", "interactive", "ar", "static"] as const;
const EVENT_TYPES = [
  "impression", "view", "tap", "swipe",
  "voice_command", "conversion", "checkout",
] as const;
const DEVICE_TYPES = ["mobile", "desktop", "tablet"] as const;
const CHANNELS = ["social", "sms", "email", "web", "qr"] as const;

const COUNTRIES = [
  { code: "US", lat: 37.09, lon: -95.71, weight: 0.22 },
  { code: "IN", lat: 20.59, lon: 78.96, weight: 0.18 },
  { code: "GB", lat: 55.38, lon: -3.44, weight: 0.10 },
  { code: "DE", lat: 51.17, lon: 10.45, weight: 0.08 },
  { code: "JP", lat: 36.2,  lon: 138.25, weight: 0.07 },
  { code: "BR", lat: -14.24, lon: -51.93, weight: 0.07 },
  { code: "AU", lat: -25.27, lon: 133.78, weight: 0.06 },
  { code: "CA", lat: 56.13, lon: -106.35, weight: 0.05 },
  { code: "FR", lat: 46.23, lon: 2.21, weight: 0.05 },
  { code: "KR", lat: 35.91, lon: 127.77, weight: 0.04 },
  { code: "SG", lat: 1.35,  lon: 103.82, weight: 0.04 },
  { code: "AE", lat: 23.42, lon: 53.85, weight: 0.04 },
];

const EVENT_WEIGHTS = [0.30, 0.25, 0.18, 0.12, 0.03, 0.08, 0.04];
const DEVICE_WEIGHTS = [0.65, 0.25, 0.10];
const CHANNEL_WEIGHTS = [0.35, 0.10, 0.15, 0.30, 0.10];
const CREATIVE_WEIGHTS = [0.30, 0.35, 0.20, 0.15];

// Viral spike days
const VIRAL_SPIKE_DAYS = new Set([12, 13, 14, 45, 46, 72, 73]);

// ─── Helpers ─────────────────────────────────────────────────────
function weightedPick<T>(items: readonly T[], weights: number[]): T {
  const r = Math.random();
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    sum += weights[i];
    if (r <= sum) return items[i];
  }
  return items[items.length - 1];
}

function weightedPickObj(items: typeof COUNTRIES): (typeof COUNTRIES)[0] {
  const r = Math.random();
  let sum = 0;
  for (const item of items) {
    sum += item.weight;
    if (r <= sum) return item;
  }
  return items[items.length - 1];
}

function randInt(min: number, max: number): number {
  return (Math.random() * (max - min + 1) + min) | 0;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  console.log(`\n${"━".repeat(60)}`);
  console.log(`  PULSE DATA GENERATOR`);
  console.log(`  Target: ${(TOTAL_EVENTS / 1e6).toFixed(1)}M events · ${DAYS} days · DuckDB + Parquet`);
  console.log(`${"━".repeat(60)}\n`);

  const t0 = performance.now();

  // ─── Initialize DuckDB ────────────────────────────────────
  console.log("  [1/5] Initialising DuckDB...");
  const db = new duckdb.Database(DB_PATH);
  const conn = db.connect();

  // Promisified query helper
  const run = (sql: string): Promise<void> =>
    new Promise((resolve, reject) => {
      conn.run(sql, (err: any) => (err ? reject(err) : resolve()));
    });

  const query = (sql: string): Promise<any[]> =>
    new Promise((resolve, reject) => {
      conn.all(sql, (err: any, rows: any[]) => (err ? reject(err) : resolve(rows)));
    });

  // ─── Create table ─────────────────────────────────────────
  console.log("  [2/5] Creating schema...");
  await run(`DROP TABLE IF EXISTS events`);
  await run(`
    CREATE TABLE events (
      event_id        VARCHAR,
      timestamp_ms    BIGINT,
      campaign_id     VARCHAR,
      campaign_name   VARCHAR,
      creative_type   VARCHAR,
      event_type      VARCHAR,
      device_type     VARCHAR,
      channel         VARCHAR,
      country         VARCHAR(2),
      lat             DOUBLE,
      lon             DOUBLE,
      session_id      VARCHAR,
      dwell_ms        INTEGER,
      revenue_usd     DOUBLE
    )
  `);

  // ─── Compute daily distribution ───────────────────────────
  console.log("  [3/5] Computing daily distribution...");
  const dailyCounts: number[] = [];
  let totalWeight = 0;
  for (let d = 0; d < DAYS; d++) {
    const dow = new Date(START_DATE + d * MS_PER_DAY).getDay();
    let w = dow >= 1 && dow <= 5 ? 1.0 : 0.6;
    if (VIRAL_SPIKE_DAYS.has(d)) w *= 3 + Math.random() * 2;
    w *= 0.7 + (d / DAYS) * 0.6;
    dailyCounts.push(w);
    totalWeight += w;
  }
  for (let d = 0; d < DAYS; d++) {
    dailyCounts[d] = Math.round((dailyCounts[d] / totalWeight) * TOTAL_EVENTS);
  }

  // ─── Generate and insert in batches ───────────────────────
  console.log(`  [4/5] Generating ${(TOTAL_EVENTS / 1e6).toFixed(1)}M events in ${BATCH_SIZE.toLocaleString()}-row batches...`);

  let counter = 0;
  let batchValues: string[] = [];
  let batchCount = 0;
  const genStart = performance.now();

  for (let d = 0; d < DAYS; d++) {
    const dayStart = START_DATE + d * MS_PER_DAY;

    for (let i = 0; i < dailyCounts[d]; i++) {
      // Time within day — peaks around midday using sin distribution
      const hourBias = Math.sin(Math.random() * Math.PI);
      const msInDay = Math.floor(hourBias * MS_PER_DAY * 0.9) + randInt(0, MS_PER_DAY * 0.1);
      const ts = dayStart + Math.min(msInDay, MS_PER_DAY - 1);

      const campaign = CAMPAIGNS[randInt(0, CAMPAIGNS.length - 1)];
      const eventType = weightedPick(EVENT_TYPES, EVENT_WEIGHTS);
      const country = weightedPickObj(COUNTRIES);
      const isConversion = eventType === "conversion" || eventType === "checkout";

      const eid = `evt-${(++counter).toString(36).padStart(8, "0")}`;
      const sid = `s-${randInt(100000, 999999)}`;
      const creative = weightedPick(CREATIVE_TYPES, CREATIVE_WEIGHTS);
      const device = weightedPick(DEVICE_TYPES, DEVICE_WEIGHTS);
      const chan = weightedPick(CHANNELS, CHANNEL_WEIGHTS);
      const lat = country.lat + (Math.random() - 0.5) * 5;
      const lon = country.lon + (Math.random() - 0.5) * 5;
      const dwell = isConversion ? randInt(5000, 45000) : randInt(200, 15000);
      const rev = eventType === "checkout"
        ? +(Math.random() * 150 + 5).toFixed(2)
        : eventType === "conversion"
        ? +(Math.random() * 20 + 1).toFixed(2)
        : 0;

      batchValues.push(
        `('${eid}',${ts},'${campaign.id}','${campaign.name}','${creative}','${eventType}','${device}','${chan}','${country.code}',${lat.toFixed(4)},${lon.toFixed(4)},'${sid}',${dwell},${rev})`
      );
      batchCount++;

      // Flush batch
      if (batchCount >= BATCH_SIZE) {
        await run(`INSERT INTO events VALUES ${batchValues.join(",")}`);
        batchValues = [];
        batchCount = 0;
        const pct = ((counter / TOTAL_EVENTS) * 100).toFixed(0);
        const elapsed = ((performance.now() - genStart) / 1000).toFixed(1);
        process.stdout.write(`\r        ${counter.toLocaleString()} rows (${pct}%) · ${elapsed}s`);
      }
    }
  }

  // Flush remaining
  if (batchValues.length > 0) {
    await run(`INSERT INTO events VALUES ${batchValues.join(",")}`);
  }

  const genElapsed = ((performance.now() - genStart) / 1000).toFixed(2);
  console.log(`\n        ✓ Inserted ${counter.toLocaleString()} rows in ${genElapsed}s`);

  // ─── Export to Parquet ─────────────────────────────────────
  console.log(`  [5/5] Exporting to Parquet...`);
  const parquetPath = PARQUET_PATH.replace(/\\/g, "/");
  await run(`COPY events TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION ZSTD)`);

  // Verify
  const stats = await query(`
    SELECT
      COUNT(*) as total_rows,
      COUNT(DISTINCT campaign_id) as campaigns,
      COUNT(DISTINCT country) as countries,
      MIN(timestamp_ms) as min_ts,
      MAX(timestamp_ms) as max_ts,
      SUM(revenue_usd)::DECIMAL(12,2) as total_revenue
    FROM events
  `);

  const s = stats[0];
  const totalElapsed = ((performance.now() - t0) / 1000).toFixed(2);

  console.log(`\n${"━".repeat(60)}`);
  console.log(`  GENERATION COMPLETE — ${totalElapsed}s total`);
  console.log(`${"━".repeat(60)}`);
  console.log(`  Rows:       ${Number(s.total_rows).toLocaleString()}`);
  console.log(`  Campaigns:  ${s.campaigns}`);
  console.log(`  Countries:  ${s.countries}`);
  console.log(`  Date range: ${new Date(Number(s.min_ts)).toISOString().slice(0, 10)} → ${new Date(Number(s.max_ts)).toISOString().slice(0, 10)}`);
  console.log(`  Revenue:    $${Number(s.total_revenue).toLocaleString()}`);
  console.log(`  DuckDB:     ${DB_PATH}`);
  console.log(`  Parquet:    ${PARQUET_PATH}`);
  console.log(`${"━".repeat(60)}\n`);

  // ─── Create pre-aggregated materialized views ─────────────
  console.log("  Creating materialized aggregation tables...");

  await run(`
    CREATE OR REPLACE TABLE agg_by_day AS
    SELECT
      (timestamp_ms / 86400000) * 86400000 AS bucket,
      COUNT(*) AS cnt
    FROM events
    GROUP BY bucket
    ORDER BY bucket
  `);

  await run(`
    CREATE OR REPLACE TABLE agg_by_hour AS
    SELECT
      (timestamp_ms / 3600000) * 3600000 AS bucket,
      COUNT(*) AS cnt
    FROM events
    GROUP BY bucket
    ORDER BY bucket
  `);

  await run(`
    CREATE OR REPLACE TABLE agg_by_minute AS
    SELECT
      (timestamp_ms / 60000) * 60000 AS bucket,
      COUNT(*) AS cnt
    FROM events
    GROUP BY bucket
    ORDER BY bucket
  `);

  console.log("  ✓ Materialized agg_by_day, agg_by_hour, agg_by_minute");

  // Close
  conn.close();
  db.close(() => {
    console.log("  ✓ Database closed\n");
  });
}

main().catch((err) => {
  console.error("SEED FAILED:", err);
  process.exit(1);
});
