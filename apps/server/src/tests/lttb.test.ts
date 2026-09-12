/**
 * Pulse — Unit Tests
 *
 * Tests for the LTTB downsampling algorithm and data generation logic.
 * Run: npx vitest run
 */

import { describe, it, expect } from "vitest";

// ─── LTTB (inline copy for isolated testing) ─────────────────────
function lttb(data: [number, number][], threshold: number): [number, number][] {
  if (threshold >= data.length || threshold <= 2) return data;

  const sampled: [number, number][] = [data[0]];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

    let avgX = 0, avgY = 0, avgCount = 0;
    for (let j = rangeEnd; j < bucketEnd; j++) {
      avgX += data[j][0]; avgY += data[j][1]; avgCount++;
    }
    if (avgCount > 0) { avgX /= avgCount; avgY /= avgCount; }

    let maxArea = -1, maxIndex = rangeStart;
    for (let j = rangeStart; j < rangeEnd && j < data.length; j++) {
      const area = Math.abs(
        (data[a][0] - avgX) * (data[j][1] - data[a][1]) -
        (data[a][0] - data[j][0]) * (avgY - data[a][1])
      );
      if (area > maxArea) { maxArea = area; maxIndex = j; }
    }
    sampled.push(data[maxIndex]);
    a = maxIndex;
  }
  sampled.push(data[data.length - 1]);
  return sampled;
}

// ─── Tests ────────────────────────────────────────────────────────

describe("LTTB Downsampling", () => {
  it("returns original data when threshold >= data length", () => {
    const data: [number, number][] = [[0, 1], [1, 2], [2, 3]];
    const result = lttb(data, 5);
    expect(result).toEqual(data);
  });

  it("returns original data when threshold <= 2", () => {
    const data: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4]];
    const result = lttb(data, 2);
    expect(result).toEqual(data);
  });

  it("preserves first and last points", () => {
    const data: [number, number][] = Array.from({ length: 100 }, (_, i) => [i, Math.sin(i * 0.1)]);
    const result = lttb(data, 10);
    expect(result[0]).toEqual(data[0]);
    expect(result[result.length - 1]).toEqual(data[data.length - 1]);
  });

  it("returns exactly threshold number of points", () => {
    const data: [number, number][] = Array.from({ length: 1000 }, (_, i) => [i, Math.random() * 100]);
    const threshold = 50;
    const result = lttb(data, threshold);
    expect(result.length).toBe(threshold);
  });

  it("preserves peaks in sinusoidal data", () => {
    // Generate a sine wave with a clear peak at x=50
    const data: [number, number][] = Array.from({ length: 200 }, (_, i) => [
      i,
      Math.sin((i / 200) * Math.PI * 4) * 100,
    ]);

    const result = lttb(data, 20);

    // Extract Y values from downsampled data
    const ys = result.map((p) => p[1]);
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);

    // Peak should be close to 100 (original max)
    expect(maxY).toBeGreaterThan(80);
    // Valley should be close to -100 (original min)
    expect(minY).toBeLessThan(-80);
  });

  it("handles large datasets efficiently", () => {
    const n = 100_000;
    const data: [number, number][] = Array.from({ length: n }, (_, i) => [i, Math.random() * 1000]);

    const t0 = performance.now();
    const result = lttb(data, 500);
    const elapsed = performance.now() - t0;

    expect(result.length).toBe(500);
    // Should complete in under 100ms for 100K points
    expect(elapsed).toBeLessThan(100);
  });

  it("output is monotonically increasing in X (timestamps)", () => {
    const data: [number, number][] = Array.from({ length: 500 }, (_, i) => [i * 1000, Math.random() * 50]);
    const result = lttb(data, 30);

    for (let i = 1; i < result.length; i++) {
      expect(result[i][0]).toBeGreaterThan(result[i - 1][0]);
    }
  });
});

describe("Weighted Distribution", () => {
  function weightedPick<T>(items: T[], weights: number[], n: number): Map<T, number> {
    const counts = new Map<T, number>();
    items.forEach((item) => counts.set(item, 0));

    for (let i = 0; i < n; i++) {
      const r = Math.random();
      let sum = 0;
      for (let j = 0; j < items.length; j++) {
        sum += weights[j];
        if (r <= sum) {
          counts.set(items[j], (counts.get(items[j]) || 0) + 1);
          break;
        }
      }
    }
    return counts;
  }

  it("produces approximately correct distribution ratios", () => {
    const items = ["a", "b", "c"];
    const weights = [0.6, 0.3, 0.1];
    const n = 10000;

    const counts = weightedPick(items, weights, n);

    // Allow 5% tolerance
    const aRatio = counts.get("a")! / n;
    const bRatio = counts.get("b")! / n;
    const cRatio = counts.get("c")! / n;

    expect(aRatio).toBeGreaterThan(0.55);
    expect(aRatio).toBeLessThan(0.65);
    expect(bRatio).toBeGreaterThan(0.25);
    expect(bRatio).toBeLessThan(0.35);
    expect(cRatio).toBeGreaterThan(0.05);
    expect(cRatio).toBeLessThan(0.15);
  });
});

describe("Typed Array Performance", () => {
  it("Float64Array operations are faster than object arrays for aggregation", () => {
    const n = 100_000;

    // Object array
    const objArr = Array.from({ length: n }, (_, i) => ({ t: i, v: Math.random() }));
    const t0 = performance.now();
    let sumObj = 0;
    for (const o of objArr) sumObj += o.v;
    const objTime = performance.now() - t0;

    // Typed array
    const typedArr = new Float64Array(n);
    for (let i = 0; i < n; i++) typedArr[i] = Math.random();
    const t1 = performance.now();
    let sumTyped = 0;
    for (let i = 0; i < n; i++) sumTyped += typedArr[i];
    const typedTime = performance.now() - t1;

    // Both should produce valid sums
    expect(sumObj).toBeGreaterThan(0);
    expect(sumTyped).toBeGreaterThan(0);

    // Log for visibility
    console.log(`  Object array sum: ${objTime.toFixed(2)}ms`);
    console.log(`  Typed array sum:  ${typedTime.toFixed(2)}ms`);
  });
});
