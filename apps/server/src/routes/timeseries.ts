import { FastifyInstance } from "fastify";
import { getTimeseries } from "../db.js";

export default async function timeseriesRoute(app: FastifyInstance) {
  app.get("/api/timeseries", async (request) => {
    const q = request.query as Record<string, string>;
    const granularity = (q.granularity as "minute" | "hour" | "day") || "day";
    const filters = cleanFilters(q);
    return getTimeseries(granularity, Object.keys(filters).length > 0 ? filters : undefined);
  });
}

function cleanFilters(q: Record<string, string>) {
  const f: Record<string, string> = {};
  for (const k of ["campaignId", "deviceType", "channel", "creativeType", "country"]) {
    if (q[k]) f[k] = q[k];
  }
  return f;
}
