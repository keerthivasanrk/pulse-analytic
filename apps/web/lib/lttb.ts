/**
 * Largest Triangle Three Buckets (LTTB) downsampling algorithm.
 * Reduces N data points to `threshold` points while preserving visual shape.
 */
export function lttb(
  data: [number, number][],
  threshold: number
): [number, number][] {
  if (threshold >= data.length || threshold <= 2) return data;

  const sampled: [number, number][] = [data[0]];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(
      Math.floor((i + 2) * bucketSize) + 1,
      data.length
    );

    // Compute average of the next bucket (used as the triangle's third point)
    let avgX = 0,
      avgY = 0,
      avgCount = 0;
    for (let j = rangeEnd; j < bucketEnd; j++) {
      avgX += data[j][0];
      avgY += data[j][1];
      avgCount++;
    }
    if (avgCount > 0) {
      avgX /= avgCount;
      avgY /= avgCount;
    }

    // Find point in current bucket with max triangle area
    let maxArea = -1,
      maxIndex = rangeStart;
    for (let j = rangeStart; j < rangeEnd && j < data.length; j++) {
      const area = Math.abs(
        (data[a][0] - avgX) * (data[j][1] - data[a][1]) -
          (data[a][0] - data[j][0]) * (avgY - data[a][1])
      );
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    sampled.push(data[maxIndex]);
    a = maxIndex;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}
