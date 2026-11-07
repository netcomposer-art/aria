/**
 * The Ground table: one wavetable cycle made from a window of ground motion, as Ground Wave (calliope lab/ground-wave)
 * makes it. The window is detrended (the straight-line trend removed), mirrored so it loops without a click (the two
 * fold corners rounded), resampled to TABLE_SIZE points, the mean removed and normalised to peak 1.
 *
 * Pure and deterministic: the same window always gives the same table.
 */
import { TABLE_SIZE } from "./contract.js";

/** Samples in the window a table is made from (12.8 s at 20 samples/s). */
export const TABLE_SPAN = 256;

export interface PreparedTable {
  samples: Float32Array;
  /** RMS of the normalised cycle (peak 1). */
  rms: number;
}

/** Remove the least-squares straight line from `x` (in place). */
export function detrend(x: number[]): number[] {
  const n = x.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += x[i]!;
    sxx += i * i;
    sxy += i * x[i]!;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const icpt = (sy - slope * sx) / n;
  for (let i = 0; i < n; i++) x[i]! -= icpt + slope * i;
  return x;
}

/** The window mirrored into one cycle (x then x reversed, without repeating the ends), its two folds rounded. */
export function mirrorCycle(x: number[]): number[] {
  const n = x.length;
  const cyc = x.concat(x.slice(1, -1).reverse());
  // Mirroring keeps the level continuous but folds the slope at the two turns; round those corners.
  const m = cyc.length;
  const r = Math.max(2, Math.round(m / 96));
  const avg = new Array<number>(m);
  for (let i = 0; i < m; i++) {
    let a = 0;
    for (let k = -r; k <= r; k++) a += cyc[(i + k + m) % m]!;
    avg[i] = a / (2 * r + 1);
  }
  for (const c of [0, n - 1])
    for (let k = -3 * r; k <= 3 * r; k++) {
      const i = (c + k + m) % m;
      const w = Math.cos((k / (3 * r)) * (Math.PI / 2)) ** 2;
      cyc[i] = cyc[i]! * (1 - w) + avg[i]! * w;
    }
  return cyc;
}

/** Linear resampling of one cycle to `size` points (wrapping). */
export function resampleCycle(cyc: number[], size = TABLE_SIZE): Float32Array {
  const out = new Float32Array(size);
  const m = cyc.length;
  for (let i = 0; i < size; i++) {
    const p = (i / size) * m;
    const i0 = Math.floor(p) % m;
    const i1 = (i0 + 1) % m;
    const fr = p - Math.floor(p);
    out[i] = cyc[i0]! * (1 - fr) + cyc[i1]! * fr;
  }
  return out;
}

/** A Ground table from a window of samples, or null when the window is too short or flat. */
export function prepareTable(win: ArrayLike<number>, size = TABLE_SIZE): PreparedTable | null {
  if (win.length < 8) return null;
  const x = detrend(Array.from(win, Number));
  const out = resampleCycle(mirrorCycle(x), size);
  let mean = 0;
  for (const v of out) mean += v;
  mean /= size;
  let peak = 0;
  for (let i = 0; i < size; i++) {
    out[i]! -= mean;
    peak = Math.max(peak, Math.abs(out[i]!));
  }
  if (!(peak > 1e-12)) return null;
  let ss = 0;
  for (let i = 0; i < size; i++) {
    out[i]! /= peak;
    ss += out[i]! * out[i]!;
  }
  return { samples: out, rms: Math.sqrt(ss / size) };
}

/** The `span` samples ending at `playhead` (clamped into the buffer), or null when the buffer is shorter. */
export function tableWindow(buffer: ArrayLike<number> & { subarray?: (a: number, b: number) => ArrayLike<number> }, playhead: number, span = TABLE_SPAN): ArrayLike<number> | null {
  const n = buffer.length;
  if (n < span) return null;
  const end = Math.max(span, Math.min(n, Math.round(playhead)));
  return buffer.subarray ? buffer.subarray(end - span, end) : Array.prototype.slice.call(buffer, end - span, end);
}
