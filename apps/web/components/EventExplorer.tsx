"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchEvents, type EngagementEvent } from "@/lib/api";
import { usePulseStore } from "@/lib/store";

const PAGE = 200; // Larger pages for virtualisation
const ROW_H = 36;
const VISIBLE_ROWS = 15;

const TYPE_BADGE: Record<string, string> = {
  impression: "bg-blue-500/8 text-blue-400/80 border-blue-500/10",
  view: "bg-sky-500/8 text-sky-400/80 border-sky-500/10",
  tap: "bg-indigo-500/8 text-indigo-400/80 border-indigo-500/10",
  swipe: "bg-violet-500/8 text-violet-400/80 border-violet-500/10",
  voice_command: "bg-purple-500/8 text-purple-400/80 border-purple-500/10",
  conversion: "bg-emerald-500/8 text-emerald-400/80 border-emerald-500/10",
  checkout: "bg-amber-500/8 text-amber-400/80 border-amber-500/10",
};

const COLS = [
  { label: "Type", w: "w-24 min-w-24" },
  { label: "Campaign", w: "w-44 min-w-44" },
  { label: "Creative", w: "w-24 min-w-24" },
  { label: "Device", w: "w-20 min-w-20" },
  { label: "Channel", w: "w-20 min-w-20" },
  { label: "Geo", w: "w-14 min-w-14" },
  { label: "Revenue", w: "w-20 min-w-20" },
  { label: "Dwell", w: "w-16 min-w-16" },
  { label: "Time", w: "w-36 min-w-36" },
];


// ─── Custom Zero-Dependency Virtualised List ─────────────────────
function VirtualList({
  items,
  itemHeight,
  height,
  renderItem,
}: {
  items: EngagementEvent[];
  itemHeight: number;
  height: number;
  renderItem: (item: EngagementEvent, index: number) => React.ReactNode;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * itemHeight;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 3);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + height) / itemHeight) + 3);
  
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      style={{ height, overflowY: "auto", position: "relative" }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="custom-scrollbar"
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${startIndex * itemHeight}px)` }}>
          {visibleItems.map((item, i) => renderItem(item, startIndex + i))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function EventExplorer() {
  const [events, setEvents] = useState<EngagementEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [queryMs, setQueryMs] = useState(0);
  const filters = usePulseStore((s) => s.filters);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (c: number, s?: string) => {
    setLoading(true);
    try {
      const res = await fetchEvents(c, PAGE, s, filters);
      setEvents(res.events);
      setTotal(res.total);
      setQueryMs(res._queryMs || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { setCursor(0); load(0, search); }, [filters, load]);

  const onSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setCursor(0); load(0, v); }, 300);
  };

  const pages = Math.ceil(total / PAGE);
  const page = Math.floor(cursor / PAGE) + 1;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 gap-3 border-b border-white/[0.04]">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-200">Events</h3>
          <p className="text-[11px] text-zinc-600 mt-0.5 tabular-nums">
            {total.toLocaleString()} records · DuckDB {queryMs}ms · custom virtualised
          </p>
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full sm:w-56 h-8 px-3 rounded-md text-[13px] bg-zinc-900 border border-white/[0.06] text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-blue-500/40 transition-colors"
        />
      </div>

      {/* Column headers */}
      <div className="flex border-b border-white/[0.04] bg-zinc-950/50">
        {COLS.map((c) => (
          <div key={c.label} className={`${c.w} px-4 py-2.5 text-[10px] font-medium text-zinc-600 uppercase tracking-widest flex-shrink-0`}>
            {c.label}
          </div>
        ))}
      </div>

      {/* Virtualised list */}
      {loading ? (
        <div className="space-y-0">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center h-9 border-b border-white/[0.02]">
              {COLS.map((c) => (
                <div key={c.label} className={`${c.w} px-4 flex-shrink-0`}>
                  <div className="h-3.5 bg-zinc-800/40 rounded animate-pulse w-3/4" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center text-zinc-600 text-[13px]">No events found</div>
      ) : (
        <VirtualList
          items={events}
          itemHeight={ROW_H}
          height={ROW_H * VISIBLE_ROWS}
          renderItem={(evt, idx) => (
            <div
              key={idx}
              className="flex items-center border-b border-white/[0.02] hover:bg-white/[0.015] transition-colors text-[12px] h-[36px]"
            >
              <div className="w-24 min-w-24 px-4 flex-shrink-0">
                <span className={`badge ${TYPE_BADGE[evt.eventType] || "bg-zinc-800/50 text-zinc-500 border-zinc-700/30"}`}>
                  {evt.eventType.replace("_", " ")}
                </span>
              </div>
              <div className="w-44 min-w-44 px-4 text-zinc-400 truncate flex-shrink-0">{evt.campaignName}</div>
              <div className="w-24 min-w-24 px-4 text-zinc-500 capitalize flex-shrink-0">{evt.creativeType}</div>
              <div className="w-20 min-w-20 px-4 text-zinc-500 capitalize flex-shrink-0">{evt.deviceType}</div>
              <div className="w-20 min-w-20 px-4 text-zinc-500 capitalize flex-shrink-0">{evt.channel}</div>
              <div className="w-14 min-w-14 px-4 text-zinc-500 uppercase flex-shrink-0">{evt.country}</div>
              <div className="w-20 min-w-20 px-4 text-green-400/80 tabular-nums flex-shrink-0">
                ${evt.revenueUsd != null ? evt.revenueUsd.toFixed(2) : "0.00"}
              </div>
              <div className="w-16 min-w-16 px-4 text-zinc-500 tabular-nums flex-shrink-0">
                {(evt.dwellMs / 1000).toFixed(1)}s
              </div>
              <div className="w-36 min-w-36 px-4 text-zinc-600 tabular-nums text-[11px] flex-shrink-0">
                {new Date(evt.timestampMs).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          )}
        />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.04]">
        <span className="text-[11px] text-zinc-600 tabular-nums">
          {cursor + 1}–{Math.min(cursor + PAGE, total)} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { const c = Math.max(0, cursor - PAGE); setCursor(c); load(c, search); }}
            disabled={cursor === 0}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium text-zinc-500 border border-white/[0.06] hover:bg-white/[0.03] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            Prev
          </button>
          <span className="text-[11px] text-zinc-600 tabular-nums px-2">{page}/{pages}</span>
          <button
            onClick={() => { const c = cursor + PAGE; if (c < total) { setCursor(c); load(c, search); } }}
            disabled={cursor + PAGE >= total}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium text-zinc-500 border border-white/[0.06] hover:bg-white/[0.03] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
