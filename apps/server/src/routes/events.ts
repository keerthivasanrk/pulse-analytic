import { FastifyInstance } from "fastify";
import { getEvents } from "../db.js";

export default async function eventsRoute(app: FastifyInstance) {
  app.get("/api/events", async (request) => {
    const q = request.query as Record<string, string>;
    const cursor = parseInt(q.cursor || "0", 10);
    const limit = Math.min(parseInt(q.limit || "50", 10), 200);
    const search = q.search || undefined;
    const filters = cleanFilters(q);
    return getEvents(cursor, limit, search, Object.keys(filters).length > 0 ? filters : undefined);
  });
}

function cleanFilters(q: Record<string, string>) {
  const f: Record<string, string> = {};
  for (const k of ["campaignId", "deviceType", "channel", "creativeType", "country"]) {
    if (q[k]) f[k] = q[k];
  }
  return f;
}
