"use client";

import { useEffect, useState } from "react";
import { fetchFunnel, type FunnelStage } from "@/lib/api";
import { usePulseStore } from "@/lib/store";

export default function FunnelChart() {
  const [data, setData] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);
  const filters = usePulseStore((s) => s.filters);

  useEffect(() => {
    setLoading(true);
    fetchFunnel(filters)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) {
    return (
      <div className="card p-5 h-full">
        <h3 className="text-[14px] font-semibold text-zinc-200 mb-5">Conversion Funnel</h3>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800/40 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const maxCount = data.length > 0 ? data[0].count : 1;

  return (
    <div className="card p-5 h-full">
      <h3 className="text-[14px] font-semibold text-zinc-200 mb-5">Conversion Funnel</h3>
      <div className="space-y-4">
        {data.map((stage, i) => {
          const pct = (stage.count / maxCount) * 100;
          const dropoff =
            i > 0 ? ((1 - stage.count / data[i - 1].count) * 100).toFixed(1) : null;

          return (
            <div key={stage.stage}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium text-zinc-400">{stage.stage}</span>
                <div className="flex items-center gap-2">
                  {dropoff && (
                    <span className="text-[10px] text-zinc-600">
                      −{dropoff}%
                    </span>
                  )}
                  <span className="text-[12px] font-semibold text-zinc-200 tabular-nums">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600/60 transition-all duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
