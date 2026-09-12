"use client";

import { useEffect, useState } from "react";
import { fetchKpis, type Kpis } from "@/lib/api";
import { usePulseStore } from "@/lib/store";

const KPIS = [
  {
    key: "totalEvents" as const,
    label: "Total Events",
    format: (v: number) => formatCompact(v),
    sub: "across all campaigns",
  },
  {
    key: "impressions" as const,
    label: "Impressions",
    format: (v: number) => formatCompact(v),
    sub: "unique ad views",
  },
  {
    key: "interactionRate" as const,
    label: "Interaction Rate",
    format: (v: number) => (v * 100).toFixed(2) + "%",
    sub: "tap · swipe · voice",
  },
  {
    key: "conversionRate" as const,
    label: "Conversion Rate",
    format: (v: number) => (v * 100).toFixed(2) + "%",
    sub: "impression → convert",
  },
  {
    key: "revenue" as const,
    label: "Revenue",
    format: (v: number) => "$" + formatCompact(v),
    sub: "total earned",
  },
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function CountUp({ target, format }: { target: number; format: (v: number) => string }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const duration = 900;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) requestAnimationFrame(tick);
      else setValue(target);
    }
    requestAnimationFrame(tick);
  }, [target]);

  return <span className="tabular-nums">{format(value)}</span>;
}

export default function KpiStrip() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const filters = usePulseStore((s) => s.filters);

  useEffect(() => {
    setLoading(true);
    fetchKpis(filters)
      .then(setKpis)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {KPIS.map((cfg) => (
        <div key={cfg.key} className="card px-4 py-4 group">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-2">
            {cfg.label}
          </p>
          {loading || !kpis ? (
            <div className="h-8 w-20 bg-zinc-800/60 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-[22px] font-semibold text-zinc-100 tracking-tight leading-none">
                <CountUp target={kpis[cfg.key]} format={cfg.format} />
              </p>
              <p className="text-[11px] text-zinc-600 mt-1.5">{cfg.sub}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
