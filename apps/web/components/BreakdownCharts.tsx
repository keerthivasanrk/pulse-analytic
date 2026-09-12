"use client";

import { useEffect, useState } from "react";
import { fetchBreakdown, type BreakdownItem } from "@/lib/api";
import { usePulseStore } from "@/lib/store";

// Restrained palette — blues and neutrals
const COLORS = ["#3b82f6", "#60a5fa", "#93c5fd", "#a5b4fc", "#c4b5fd", "#818cf8"];

function Donut({ data, title }: { data: BreakdownItem[]; title: string }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const size = 120;
  const sw = 18;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;

  return (
    <div className="card p-4 flex flex-col items-center">
      <h4 className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3 self-start">
        {title}
      </h4>
      <div className="flex items-center gap-4 w-full">
        <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
          {data.slice(0, 6).map((item, i) => {
            const pct = item.count / total;
            const dash = circ * pct;
            const off = circ * offset;
            offset += pct;
            return (
              <circle
                key={item.label}
                cx={cx} cy={cx} r={r}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={sw}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-off}
                opacity={0.75}
                className="transition-all duration-500"
              />
            );
          })}
          <text
            x={cx} y={cx}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-zinc-400 text-[11px] font-medium rotate-90"
            style={{ transformOrigin: `${cx}px ${cx}px` }}
          >
            {fmtK(total)}
          </text>
        </svg>

        <div className="flex flex-col gap-1 min-w-0">
          {data.slice(0, 5).map((item, i) => (
            <div key={item.label} className="flex items-center gap-2 text-[11px]">
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length], opacity: 0.75 }}
              />
              <span className="text-zinc-500 capitalize truncate">{item.label}</span>
              <span className="text-zinc-300 font-medium tabular-nums ml-auto">
                {((item.count / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmtK(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toString();
}

export default function BreakdownCharts() {
  const [device, setDevice] = useState<BreakdownItem[]>([]);
  const [channel, setChannel] = useState<BreakdownItem[]>([]);
  const [creative, setCreative] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const filters = usePulseStore((s) => s.filters);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchBreakdown("deviceType", filters),
      fetchBreakdown("channel", filters),
      fetchBreakdown("creativeType", filters),
    ])
      .then(([d, ch, cr]) => { setDevice(d); setChannel(ch); setCreative(cr); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-4 h-44 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Donut data={device} title="Device" />
      <Donut data={channel} title="Channel" />
      <Donut data={creative} title="Creative" />
    </div>
  );
}
