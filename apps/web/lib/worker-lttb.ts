/**
 * Pulse — Worker-based LTTB
 *
 * Runs LTTB in a Web Worker via inline Blob URL.
 * Uses Float64Array Transferable for zero-copy.
 * Falls back to main-thread if Worker unavailable.
 */

import { lttb as mainThreadLttb } from "./lttb";

// ─── Inline worker source ────────────────────────────────────────
const WORKER_SRC = `
function lttb(data, threshold) {
  const n = data.length / 2;
  if (threshold >= n || threshold <= 2) return data;

  const result = new Float64Array(threshold * 2);
  result[0] = data[0];
  result[1] = data[1];

  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);

    let avgX = 0, avgY = 0, avgCount = 0;
    for (let j = rangeEnd; j < bucketEnd; j++) {
      avgX += data[j * 2]; avgY += data[j * 2 + 1]; avgCount++;
    }
    if (avgCount > 0) { avgX /= avgCount; avgY /= avgCount; }

    let maxArea = -1, maxIdx = rangeStart;
    const ax = data[a * 2], ay = data[a * 2 + 1];
    for (let j = rangeStart; j < rangeEnd && j < n; j++) {
      const area = Math.abs(
        (ax - avgX) * (data[j * 2 + 1] - ay) - (ax - data[j * 2]) * (avgY - ay)
      );
      if (area > maxArea) { maxArea = area; maxIdx = j; }
    }

    const outIdx = (i + 1) * 2;
    result[outIdx] = data[maxIdx * 2];
    result[outIdx + 1] = data[maxIdx * 2 + 1];
    a = maxIdx;
  }

  result[(threshold - 1) * 2] = data[(n - 1) * 2];
  result[(threshold - 1) * 2 + 1] = data[(n - 1) * 2 + 1];
  return result;
}

self.onmessage = function(e) {
  const { type, data, threshold, id } = e.data;
  if (type === 'lttb') {
    const t0 = performance.now();
    const input = new Float64Array(data);
    const result = lttb(input, threshold);
    const elapsed = performance.now() - t0;
    self.postMessage({ type: 'lttb-result', id, data: result.buffer, points: result.length / 2, elapsed: Math.round(elapsed * 100) / 100 }, [result.buffer]);
  }
};
`;

// ─── Worker Manager ──────────────────────────────────────────────
let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, (result: { data: [number, number][]; elapsed: number }) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof window === "undefined") return null;

  try {
    const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);

    worker.onmessage = (e) => {
      const { type, id, data, points, elapsed } = e.data;
      if (type === "lttb-result" && pending.has(id)) {
        const arr = new Float64Array(data);
        const pairs: [number, number][] = [];
        for (let i = 0; i < points; i++) {
          pairs.push([arr[i * 2], arr[i * 2 + 1]]);
        }
        pending.get(id)!({ data: pairs, elapsed });
        pending.delete(id);
      }
    };

    worker.onerror = () => {
      console.warn("[Worker] Error — falling back to main thread");
      worker = null;
    };

    return worker;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Downsample timeseries data using LTTB.
 * Offloads to Web Worker when available, falls back to main thread.
 */
export function lttbAsync(
  data: [number, number][],
  threshold: number
): Promise<{ data: [number, number][]; elapsed: number; offloaded: boolean }> {
  const w = getWorker();

  if (!w || data.length < 1000) {
    // Not worth offloading small datasets
    const t0 = performance.now();
    const result = mainThreadLttb(data, threshold);
    return Promise.resolve({
      data: result,
      elapsed: Math.round((performance.now() - t0) * 100) / 100,
      offloaded: false,
    });
  }

  return new Promise((resolve) => {
    const id = ++requestId;

    // Convert to Float64Array for Transferable
    const buffer = new Float64Array(data.length * 2);
    for (let i = 0; i < data.length; i++) {
      buffer[i * 2] = data[i][0];
      buffer[i * 2 + 1] = data[i][1];
    }

    pending.set(id, (result) => {
      resolve({ ...result, offloaded: true });
    });

    w.postMessage(
      { type: "lttb", data: buffer.buffer, threshold, id },
      [buffer.buffer] // Transfer, not copy
    );

    // Timeout fallback
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        const t0 = performance.now();
        const result = mainThreadLttb(data, threshold);
        resolve({
          data: result,
          elapsed: Math.round((performance.now() - t0) * 100) / 100,
          offloaded: false,
        });
      }
    }, 5000);
  });
}
