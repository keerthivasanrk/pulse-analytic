"use client";

import { useEffect, useRef, useState } from "react";
import { fetchGeo, type GeoItem } from "@/lib/api";
import { usePulseStore } from "@/lib/store";

function project(lat: number, lon: number, w: number, h: number): [number, number] {
  const x = ((lon + 180) / 360) * w;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (mercN / Math.PI) * (h / 2);
  return [x, y];
}

export default function GeoHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<GeoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<GeoItem | null>(null);
  const filters = usePulseStore((s) => s.filters);

  useEffect(() => {
    setLoading(true);
    fetchGeo(filters).then(setGeo).catch(console.error).finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || geo.length === 0) return;

    const w = container.getBoundingClientRect().width;
    const h = 240;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#0c0c0e";
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.02)";
    ctx.lineWidth = 1;
    for (let lon = -150; lon <= 180; lon += 30) {
      const [x] = project(0, lon, w, h);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let lat = -60; lat <= 80; lat += 30) {
      const [, y] = project(lat, 0, w, h);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const maxCount = Math.max(...geo.map((d) => d.count));

    for (const item of geo) {
      const [x, y] = project(item.lat, item.lon, w, h);
      const n = item.count / maxCount;

      // Soft glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 12 + n * 25);
      glow.addColorStop(0, `rgba(59, 130, 246, ${0.15 * n})`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 12 + n * 25, 0, Math.PI * 2);
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, 2.5 + n * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96, 165, 250, ${0.5 + n * 0.5})`;
      ctx.fill();

      // Label for top items
      if (n > 0.15) {
        ctx.fillStyle = `rgba(161, 161, 170, ${0.4 + n * 0.4})`;
        ctx.font = "10px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(item.country, x, y - 6 - n * 5);
      }
    }
  }, [geo]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || geo.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let closest: GeoItem | null = null, minD = 25;
    for (const item of geo) {
      const [x, y] = project(item.lat, item.lon, rect.width, 240);
      const d = Math.hypot(mx - x, my - y);
      if (d < minD) { minD = d; closest = item; }
    }
    setHovered(closest);
  };

  return (
    <div ref={containerRef} className="card overflow-hidden h-full">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-[14px] font-semibold text-zinc-200">Geography</h3>
        <p className="text-[11px] text-zinc-600 mt-0.5">Engagement by country</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[240px]">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseMove={onMove}
            onMouseLeave={() => setHovered(null)}
            className="cursor-crosshair"
          />
          {hovered && (
            <div className="absolute top-3 right-3 bg-zinc-900 border border-white/[0.08] rounded-lg px-3 py-2 shadow-xl shadow-black/40">
              <p className="text-[13px] font-semibold text-zinc-200">{hovered.country}</p>
              <p className="text-[11px] text-zinc-500 tabular-nums">
                {hovered.count.toLocaleString()} events · ${hovered.revenue.toLocaleString()} rev
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
