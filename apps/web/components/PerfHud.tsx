"use client";

import { useEffect } from "react";
import { usePulseStore } from "@/lib/store";

export default function PerfHud() {
  const show = usePulseStore((s) => s.showPerfHud);
  const toggle = usePulseStore((s) => s.togglePerfHud);
  const fps = usePulseStore((s) => s.fps);
  const heap = usePulseStore((s) => s.heapMb);
  const evtSec = usePulseStore((s) => s.liveEventsPerSec);

  useEffect(() => {
    const setHeap = usePulseStore.getState().setHeapMb;
    const id = setInterval(() => {
      if ((performance as any).memory) {
        setHeap(Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        const tag = document.activeElement?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !e.ctrlKey && !e.metaKey) {
          toggle();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-zinc-950/95 border border-white/[0.08] rounded-lg backdrop-blur-sm shadow-2xl shadow-black/50 p-3 min-w-[180px] font-mono text-[11px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-500 font-sans text-[10px] uppercase tracking-widest font-medium">Perf</span>
        <button onClick={toggle} className="text-zinc-600 hover:text-zinc-400 transition-colors text-[10px]">✕</button>
      </div>
      <div className="space-y-1">
        <Row label="FPS" value={fps} color={fps >= 55 ? "text-emerald-500/80" : fps >= 30 ? "text-amber-500/80" : "text-red-500/80"} />
        <Row label="Heap" value={`${heap} MB`} color="text-zinc-300" />
        <Row label="WS" value={`${evtSec}/s`} color="text-blue-400/80" />
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-600">{label}</span>
      <span className={`${color} tabular-nums font-medium`}>{value}</span>
    </div>
  );
}
