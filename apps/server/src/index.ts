/**
 * Pulse — Server Entry Point
 * Fastify + DuckDB + WebSocket
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { loadData, getRandomEvent } from "./db.js";
import kpisRoute from "./routes/kpis.js";
import timeseriesRoute from "./routes/timeseries.js";
import breakdownRoute from "./routes/breakdown.js";
import funnelRoute from "./routes/funnel.js";
import eventsRoute from "./routes/events.js";
import geoRoute from "./routes/geo.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PULSE API SERVER");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await loadData();

  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, methods: ["GET", "POST", "OPTIONS"] });
  await app.register(websocket);

  await app.register(kpisRoute);
  await app.register(timeseriesRoute);
  await app.register(breakdownRoute);
  await app.register(funnelRoute);
  await app.register(eventsRoute);
  await app.register(geoRoute);

  app.setErrorHandler((error, request, reply) => {
    console.error(`[API Error] ${request.method} ${request.url}`, error);
    reply.status(500).send({ error: "Internal Server Error" });
  });

  app.get("/api/health", async () => ({
    status: "ok",
    engine: "DuckDB",
    timestamp: Date.now(),
  }));

  // WebSocket live event stream
  app.register(async function (fastify) {
    fastify.get("/live", { websocket: true }, (socket, req) => {
      console.log("  [WS] Client connected");

      const interval = setInterval(async () => {
        if (socket.readyState === 1) {
          try {
            const event = await getRandomEvent();
            socket.send(JSON.stringify(event));
          } catch {
            // ignore
          }
        }
      }, 300);

      socket.on("message", (msg: any) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === "ping") {
            socket.send(JSON.stringify({ type: "pong" }));
          }
        } catch {}
      });

      socket.on("close", () => {
        console.log("  [WS] Client disconnected");
        clearInterval(interval);
      });

      socket.on("error", () => clearInterval(interval));
    });
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`\n  ✓ API:       http://localhost:${PORT}`);
  console.log(`  ✓ WebSocket: ws://localhost:${PORT}/live`);
  console.log(`  ✓ Engine:    DuckDB (columnar SQL)\n`);
}

main();
