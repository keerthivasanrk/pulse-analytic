/**
 * Pulse — Aggregation Web Worker
 *
 * Runs LTTB downsampling off the main thread.
 * Receives Float64Array pairs via Transferable, returns downsampled data.
 */

// LTTB implementation (duplicated here because workers have separate scope)
function lttb(data: Float64Array, threshold: number): Float64Array {
  const n = data.length / 2; // pairs of [timestamp, count]
  if (threshold >= n || threshold <= 2) return data;

  const result = new Float64Array(threshold * 2);
  // First point
  result[0] = data[0];
  result[1] = data[1];

  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0; // index of previously selected point

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);

    // Average of next bucket
    let avgX = 0, avgY = 0, avgCount = 0;
    for (let j = rangeEnd; j < bucketEnd; j++) {
      avgX += data[j * 2];
      avgY += data[j * 2 + 1];
      avgCount++;
    }
    if (avgCount > 0) { avgX /= avgCount; avgY /= avgCount; }

    // Find point with max triangle area
    let maxArea = -1, maxIdx = rangeStart;
    const ax = data[a * 2], ay = data[a * 2 + 1];
    for (let j = rangeStart; j < rangeEnd && j < n; j++) {
      const area = Math.abs(
        (ax - avgX) * (data[j * 2 + 1] - ay) -
        (ax - data[j * 2]) * (avgY - ay)
      );
      if (area > maxArea) { maxArea = area; maxIdx = j; }
    }

    const outIdx = (i + 1) * 2;
    result[outIdx] = data[maxIdx * 2];
    result[outIdx + 1] = data[maxIdx * 2 + 1];
    a = maxIdx;
  }

  // Last point
  result[(threshold - 1) * 2] = data[(n - 1) * 2];
  result[(threshold - 1) * 2 + 1] = data[(n - 1) * 2 + 1];

  return result;
}

// ─── Worker message handler ──────────────────────────────────────
self.onmessage = function (e: MessageEvent) {
  const { type, data, threshold, id } = e.data;

  if (type === "lttb") {
    const t0 = performance.now();
    const input = new Float64Array(data);
    const result = lttb(input, threshold);
    const elapsed = performance.now() - t0;

    // Transfer the buffer back (zero-copy)
    (self as any).postMessage(
      {
        type: "lttb-result",
        id,
        data: result.buffer,
        points: result.length / 2,
        elapsed: Math.round(elapsed * 100) / 100,
      },
      [result.buffer]
    );
  }
};
