"use client";

import { useEffect } from "react";
import { subscribeLiveEvents } from "@/lib/websocket";
import { usePulseStore } from "@/lib/store";

const TYPE_STYLE: Record<string, string> = {
  impression: "text-blue-400/70",
  view: "text-blue-300/70",
  tap: "text-indigo-400/70",
  swipe: "text-violet-400/70",
  voice_command: "text-purple-400/70",
  conversion: "text-emerald-400/70",
  checkout: "text-amber-400/70",
};

export default function LiveTicker() {
  const liveEvents = usePulseStore((s) => s.liveEvents);
  const evtPerSec = usePulseStore((s) => s.liveEventsPerSec);
  const addLiveEvent = usePulseStore((s) => s.addLiveEvent);

  useEffect(() => {
    const unsub = subscribeLiveEvents(addLiveEvent);
    return unsub;
  }, [addLiveEvent]);

  return (
    <div className="card overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
          <h3 className="text-[14px] font-semibold text-zinc-200">Live Feed</h3>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[18px] font-semibold text-zinc-200 tabular-nums">{evtPerSec}</span>
          <span className="text-[10px] text-zinc-600 font-medium">evt/s</span>
        </div>
      </div>

      {/* Events */}
      <div className="flex-1 overflow-hidden">
        <div className="p-2 space-y-px">
          {liveEvents.slice(0, 14).map((evt, i) => (
            <div
              key={evt.eventId + i}
              className="flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-white/[0.02] transition-colors duration-150"
              style={{ opacity: 1 - i * 0.06 }}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider w-20 flex-shrink-0 ${
                  TYPE_STYLE[evt.eventType] || "text-zinc-500"
                }`}
              >
                {evt.eventType.replace("_", " ")}
              </span>
              <span className="text-[11px] text-zinc-500 truncate flex-1">
                {evt.campaignName}
              </span>
              <span className="text-[10px] text-zinc-700 flex-shrink-0">
                {evt.country}
              </span>
              {evt.revenueUsd > 0 && (
                <span className="text-[10px] text-emerald-500/60 font-medium tabular-nums flex-shrink-0">
                  +${evt.revenueUsd.toFixed(0)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
