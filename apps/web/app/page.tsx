"use client";

import dynamic from "next/dynamic";
import KpiStrip from "@/components/KpiStrip";
import FilterBar from "@/components/FilterBar";
import PerfHud from "@/components/PerfHud";

// ─── Code-split heavy components ─────────────────────────────────
// These import lazily: each gets its own chunk, loaded on demand.
// Prevents the initial JS bundle from including Canvas/SVG/WebSocket code.

const HeroChart = dynamic(() => import("@/components/HeroChart"), {
  loading: () => <Skeleton h="h-[360px]" />,
  ssr: false, // Canvas 2D — no SSR
});

const FunnelChart = dynamic(() => import("@/components/FunnelChart"), {
  loading: () => <Skeleton h="h-[300px]" />,
});

const BreakdownCharts = dynamic(() => import("@/components/BreakdownCharts"), {
  loading: () => <Skeleton h="h-[200px]" />,
});

const GeoHeatmap = dynamic(() => import("@/components/GeoHeatmap"), {
  loading: () => <Skeleton h="h-[300px]" />,
  ssr: false, // Canvas
});

const LiveTicker = dynamic(() => import("@/components/LiveTicker"), {
  loading: () => <Skeleton h="h-[300px]" />,
  ssr: false, // WebSocket
});

const EventExplorer = dynamic(() => import("@/components/EventExplorer"), {
  loading: () => <Skeleton h="h-[580px]" />,
  ssr: false, // react-window
});

function Skeleton({ h }: { h: string }) {
  return <div className={`card ${h} animate-pulse`} />;
}

export default function Dashboard() {
  return (
    <main className="min-h-screen">
      {/* ─── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-100">
              Pulse
            </span>
            <span className="text-[11px] text-zinc-600 font-medium ml-1 hidden sm:inline">
              Analytics
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
              <span className="font-medium">Live</span>
            </div>
            <div className="h-3.5 w-px bg-zinc-800" />
            <span className="text-[11px] text-zinc-600 font-medium tracking-wide">
              1M events · DuckDB
            </span>
          </div>
        </div>
      </header>

      {/* ─── Content ──────────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
        <section className="animate-in">
          <FilterBar />
        </section>

        <section className="animate-in animate-in-delay-1">
          <KpiStrip />
        </section>

        <section className="animate-in animate-in-delay-2">
          <HeroChart />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in animate-in-delay-3">
          <div className="lg:col-span-4">
            <FunnelChart />
          </div>
          <div className="lg:col-span-8">
            <BreakdownCharts />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in animate-in-delay-4">
          <div className="lg:col-span-7">
            <GeoHeatmap />
          </div>
          <div className="lg:col-span-5">
            <LiveTicker />
          </div>
        </div>

        <section className="animate-in animate-in-delay-5">
          <EventExplorer />
        </section>

        <div className="h-4" />
      </div>

      <PerfHud />
    </main>
  );
}
