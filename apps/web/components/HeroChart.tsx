"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fetchTimeseries, type TimeseriesPoint } from "@/lib/api";
import { lttbAsync } from "@/lib/worker-lttb";
import { usePulseStore } from "@/lib/store";

const PADDING = { top: 24, right: 16, bottom: 40, left: 56 };
const TARGET_POINTS = 800;

export default function HeroChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rawData, setRawData] = useState<TimeseriesPoint[]>([]);
  const [queryMs, setQueryMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<"minute" | "hour" | "day">("day");
  const [hovered, setHovered] = useState<{ x: number; y: number; ts: number; count: number } | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 320 });
  const filters = usePulseStore((s) => s.filters);
  const setFps = usePulseStore((s) => s.setFps);
  const ptsRef = useRef<[number, number][]>([]);
  const [lttbInfo, setLttbInfo] = useState({ elapsed: 0, offloaded: false });

  useEffect(() => {
    setLoading(true);
    fetchTimeseries(granularity, filters)
      .then((res) => {
        setRawData(res.data);
        setQueryMs(res._queryMs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [granularity, filters]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: Math.max(280, Math.min(360, e.contentRect.width * 0.35)) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rawData.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    ctx.scale(dpr, dpr);

    const pairs: [number, number][] = rawData.map((p) => [p.timestamp, p.count]);

    // Async LTTB — runs in Web Worker for large datasets
    lttbAsync(pairs, TARGET_POINTS).then(({ data: downsampled, elapsed, offloaded }) => {
      ptsRef.current = downsampled;
      setLttbInfo({ elapsed, offloaded });
    });
  }, [rawData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || ptsRef.current.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    ctx.scale(dpr, dpr);

    const pts = ptsRef.current;
    const pw = dims.w - PADDING.left - PADDING.right;
    const ph = dims.h - PADDING.top - PADDING.bottom;
    const minX = pts[0][0], maxX = pts[pts.length - 1][0];
    const maxY = Math.max(...pts.map((p) => p[1])) * 1.08;

    const sx = (v: number) => PADDING.left + ((v - minX) / (maxX - minX || 1)) * pw;
    const sy = (v: number) => PADDING.top + ph - (v / (maxY || 1)) * ph;

    let fid: number, fc = 0, ft = 0;

    function draw(t: number) {
      fc++;
      if (t - ft >= 1000) { setFps(fc); fc = 0; ft = t; }

      ctx!.clearRect(0, 0, dims.w, dims.h);

      // ─── Grid ────────────────────────────────────
      const yTicks = 5;
      ctx!.textBaseline = "middle";
      for (let i = 0; i <= yTicks; i++) {
        const y = PADDING.top + (ph / yTicks) * i;
        const val = maxY * (1 - i / yTicks);

        // Grid line
        ctx!.strokeStyle = "rgba(255,255,255,0.04)";
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(PADDING.left, y);
        ctx!.lineTo(dims.w - PADDING.right, y);
        ctx!.stroke();

        // Label
        ctx!.fillStyle = "rgba(255,255,255,0.25)";
        ctx!.font = "11px Inter, system-ui, sans-serif";
        ctx!.textAlign = "right";
        ctx!.fillText(fmtY(val), PADDING.left - 8, y);
      }

      // X labels
      const xCount = Math.min(7, pts.length);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "top";
      for (let i = 0; i < xCount; i++) {
        const idx = Math.floor((i / (xCount - 1)) * (pts.length - 1));
        ctx!.fillStyle = "rgba(255,255,255,0.25)";
        ctx!.font = "11px Inter, system-ui, sans-serif";
        ctx!.fillText(fmtX(new Date(pts[idx][0]), granularity), sx(pts[idx][0]), dims.h - PADDING.bottom + 10);
      }

      // ─── Area fill ───────────────────────────────
      ctx!.beginPath();
      ctx!.moveTo(sx(pts[0][0]), sy(0));
      for (const [x, y] of pts) ctx!.lineTo(sx(x), sy(y));
      ctx!.lineTo(sx(pts[pts.length - 1][0]), sy(0));
      ctx!.closePath();

      const grad = ctx!.createLinearGradient(0, PADDING.top, 0, dims.h - PADDING.bottom);
      grad.addColorStop(0, "rgba(59, 130, 246, 0.12)");
      grad.addColorStop(1, "rgba(59, 130, 246, 0.01)");
      ctx!.fillStyle = grad;
      ctx!.fill();

      // ─── Line ────────────────────────────────────
      ctx!.beginPath();
      ctx!.strokeStyle = "rgba(59, 130, 246, 0.7)";
      ctx!.lineWidth = 1.5;
      ctx!.lineJoin = "round";
      for (let i = 0; i < pts.length; i++) {
        const x = sx(pts[i][0]), y = sy(pts[i][1]);
        i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
      }
      ctx!.stroke();

      // ─── Hover ───────────────────────────────────
      if (hovered) {
        // Vertical line
        ctx!.strokeStyle = "rgba(255,255,255,0.1)";
        ctx!.lineWidth = 1;
        ctx!.setLineDash([3, 3]);
        ctx!.beginPath();
        ctx!.moveTo(hovered.x, PADDING.top);
        ctx!.lineTo(hovered.x, dims.h - PADDING.bottom);
        ctx!.stroke();
        ctx!.setLineDash([]);

        // Dot
        ctx!.beginPath();
        ctx!.arc(hovered.x, hovered.y, 4, 0, Math.PI * 2);
        ctx!.fillStyle = "#3b82f6";
        ctx!.fill();
        ctx!.strokeStyle = "#09090b";
        ctx!.lineWidth = 2;
        ctx!.stroke();
      }

      fid = requestAnimationFrame(draw);
    }

    fid = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(fid);
  }, [rawData, dims, hovered, granularity, lttbInfo]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pts = ptsRef.current;
    if (pts.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;

    const pw = dims.w - PADDING.left - PADDING.right;
    const ph = dims.h - PADDING.top - PADDING.bottom;
    const minX = pts[0][0], maxX = pts[pts.length - 1][0];
    const maxY = Math.max(...pts.map((p) => p[1])) * 1.08;

    const tsAt = minX + ((mx - PADDING.left) / pw) * (maxX - minX);
    let best = pts[0], bestD = Infinity;
    for (const p of pts) { const d = Math.abs(p[0] - tsAt); if (d < bestD) { bestD = d; best = p; } }

    const x = PADDING.left + ((best[0] - minX) / (maxX - minX || 1)) * pw;
    const y = PADDING.top + ph - (best[1] / (maxY || 1)) * ph;
    setHovered({ x, y, ts: best[0], count: best[1] });
  }, [dims]);

  return (
    <div ref={containerRef} className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h2 className="text-[14px] font-semibold text-zinc-200">Event Volume</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5 tabular-nums">
            {rawData.length.toLocaleString()} pts · LTTB → {ptsRef.current.length} · {lttbInfo.offloaded ? "Worker" : "Main"} {lttbInfo.elapsed}ms · DuckDB {queryMs}ms
          </p>
        </div>
        <div className="flex rounded-md border border-white/[0.06] overflow-hidden">
          {(["day", "hour", "minute"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 text-[11px] font-medium transition-colors duration-150 ${
                granularity === g
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      {loading ? (
        <div className="flex items-center justify-center h-[320px]">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            style={{ width: dims.w, height: dims.h }}
            className="cursor-crosshair"
            onMouseMove={onMouseMove}
            onMouseLeave={() => setHovered(null)}
          />
          {hovered && (
            <div
              className="absolute pointer-events-none z-10 bg-zinc-900 border border-white/[0.08] rounded-lg px-3 py-2 shadow-xl shadow-black/40"
              style={{
                left: Math.min(hovered.x + 12, dims.w - 150),
                top: Math.max(hovered.y - 52, 8),
              }}
            >
              <p className="text-[11px] text-zinc-500">
                {new Date(hovered.ts).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                  ...(granularity !== "day" && { hour: "2-digit", minute: "2-digit" }),
                })}
              </p>
              <p className="text-[14px] font-semibold text-zinc-100 tabular-nums mt-0.5">
                {hovered.count.toLocaleString()} events
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtY(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return Math.round(v).toString();
}

function fmtX(d: Date, g: string): string {
  if (g === "day") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
