import { FastifyInstance } from "fastify";
import { getBreakdown } from "../db.js";

export default async function breakdownRoute(app: FastifyInstance) {
  app.get("/api/breakdown", async (request) => {
    const q = request.query as Record<string, string>;
    const dimension = q.dimension || "deviceType";
    const filters = cleanFilters(q);
    return getBreakdown(dimension, Object.keys(filters).length > 0 ? filters : undefined);
  });
}

function cleanFilters(q: Record<string, string>) {
  const f: Record<string, string> = {};
  for (const k of ["campaignId", "deviceType", "channel", "creativeType", "country"]) {
    if (q[k]) f[k] = q[k];
  }
  return f;
}
