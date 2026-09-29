export interface TimingSummary {
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  samplesMs: number[];
}

/** Jalankan fn N kali, kumpulkan rata-rata/min/max (≥30 percobaan agar hasil andal). */
export async function measure(fn: () => unknown | Promise<unknown>, iterations: number): Promise<TimingSummary> {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    iterations,
    avgMs: sum / iterations,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    samplesMs: samples,
  };
}
