import { FastifyInstance } from "fastify";
import { getKpis } from "../db.js";

export default async function kpisRoute(app: FastifyInstance) {
  app.get("/api/kpis", async (request) => {
    const q = request.query as Record<string, string>;
    const filters = cleanFilters(q);
    return getKpis(Object.keys(filters).length > 0 ? filters : undefined);
  });
}

function cleanFilters(q: Record<string, string>) {
  const f: Record<string, string> = {};
  for (const k of ["campaignId", "deviceType", "channel", "creativeType", "country"]) {
    if (q[k]) f[k] = q[k];
  }
  return f;
}
