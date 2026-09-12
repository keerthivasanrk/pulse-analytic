/**
 * Pulse — Global State Store (Zustand)
 * Manages filter state, live event buffer, and data cache.
 */

import { create } from "zustand";
import type { Filters, EngagementEvent } from "./api";

interface PulseStore {
  // Filters
  filters: Filters;
  setFilter: (key: keyof Filters, value: string | undefined) => void;
  clearFilters: () => void;

  // Live events
  liveEvents: EngagementEvent[];
  liveEventsPerSec: number;
  addLiveEvent: (event: EngagementEvent) => void;

  // Performance HUD
  showPerfHud: boolean;
  togglePerfHud: () => void;
  fps: number;
  setFps: (fps: number) => void;
  heapMb: number;
  setHeapMb: (mb: number) => void;
}

const MAX_LIVE_EVENTS = 100;
let eventTimestamps: number[] = [];

export const usePulseStore = create<PulseStore>((set, get) => ({
  // Filters
  filters: {},
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value || undefined },
    })),
  clearFilters: () => set({ filters: {} }),

  // Live events
  liveEvents: [],
  liveEventsPerSec: 0,
  addLiveEvent: (event) => {
    const now = Date.now();
    eventTimestamps.push(now);
    // Keep only last second's timestamps for rate calc
    eventTimestamps = eventTimestamps.filter((t) => now - t < 1000);

    set((state) => ({
      liveEvents: [event, ...state.liveEvents].slice(0, MAX_LIVE_EVENTS),
      liveEventsPerSec: eventTimestamps.length,
    }));
  },

  // Performance HUD
  showPerfHud: false,
  togglePerfHud: () => set((state) => ({ showPerfHud: !state.showPerfHud })),
  fps: 0,
  setFps: (fps) => set({ fps }),
  heapMb: 0,
  setHeapMb: (mb) => set({ heapMb: mb }),
}));
