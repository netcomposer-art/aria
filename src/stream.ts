/**
 * The stream buffer: the last 30 minutes of one channel's samples, as records arrive (out of order, overlapping, with
 * gaps). Ground Wave's rules: an overlap keeps only the new tail; a gap up to 60 s is held at the last value; a longer
 * gap starts over. Positions are absolute sample indices (`start` + i), so a lane's playhead survives trimming.
 * Channels faster than 25 samples/s are averaged down to about 20, so a table's span means the same time everywhere.
 */
import type { MseedRecord } from "./mseed";

export const KEEP_SEC = 30 * 60;
export const MAX_GAP_SEC = 60;
export const TARGET_RATE = 20;

export class StreamBuffer {
  data: Float64Array = new Float64Array(0);
  /** Absolute index of data[0]. */
  start = 0;
  /** Epoch ms of absolute index 0 (the first sample ever kept, minus start/rate). */
  t0 = 0;
  /** Samples per second after any decimation (0: nothing yet). */
  rate = 0;
  id = "";
  /** Bumped when the buffer starts over (a new channel, a long gap): positions from before mean nothing. */
  epoch = 0;
  private factor = 1;

  /** Absolute index one past the newest sample. */
  get end(): number {
    return this.start + this.data.length;
  }
  /** Epoch ms of absolute index `i`. */
  timeAt(i: number): number {
    return this.t0 + (i / this.rate) * 1000;
  }
  /** Epoch ms just after the newest sample. */
  get endMs(): number {
    return this.rate ? this.timeAt(this.end) : 0;
  }
  /** The samples between two absolute indices (clamped). */
  slice(from: number, to: number): Float64Array {
    const a = Math.max(0, Math.min(this.data.length, Math.round(from - this.start)));
    const b = Math.max(a, Math.min(this.data.length, Math.round(to - this.start)));
    return this.data.subarray(a, b);
  }

  reset(): void {
    this.data = new Float64Array(0);
    this.start = 0;
    this.t0 = 0;
    this.rate = 0;
    this.id = "";
    this.factor = 1;
    this.epoch++;
  }

  /** Add a record. Returns true when the buffer started over. */
  append(rec: MseedRecord): boolean {
    if (!rec.rate || !rec.samples.length) return false;
    const id = [rec.net, rec.sta, rec.loc, rec.cha].join(".");
    const factor = rec.rate > 25 ? Math.max(1, Math.round(rec.rate / TARGET_RATE)) : 1;
    const rate = rec.rate / factor;
    const samples = factor > 1 ? decimate(rec.samples, factor) : rec.samples;
    const restart = () => {
      this.reset();
      this.id = id;
      this.rate = rate;
      this.factor = factor;
      this.data = Float64Array.from(samples);
      this.t0 = rec.startMs;
      return true;
    };
    if (!this.rate || Math.abs(this.rate - rate) > 1e-6 || this.id !== id) return restart();
    const dtSamp = ((rec.startMs - this.endMs) / 1000) * this.rate;
    let add: Float64Array = samples;
    if (dtSamp < -0.5) {
      const skip = Math.round(-dtSamp);
      if (skip >= add.length) return false;
      add = add.subarray(skip);
    } else if (dtSamp > 1.5) {
      const gap = Math.round(dtSamp);
      if (gap > this.rate * MAX_GAP_SEC) return restart();
      const fill = new Float64Array(gap).fill(this.data[this.data.length - 1] ?? 0);
      add = concat(fill, add);
    }
    let next: Float64Array = concat(this.data, add);
    const max = Math.round(KEEP_SEC * this.rate);
    if (next.length > max) {
      const cut = next.length - max;
      next = next.slice(cut);
      this.start += cut;
    }
    this.data = next;
    return false;
  }
}

function concat(a: Float64Array, b: Float64Array): Float64Array {
  const o = new Float64Array(a.length + b.length);
  o.set(a);
  o.set(b, a.length);
  return o;
}

/** Average each run of `factor` samples (a box filter before keeping one in `factor`). */
export function decimate(x: Float64Array, factor: number): Float64Array {
  const n = Math.floor(x.length / factor);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += x[i * factor + k]!;
    out[i] = s / factor;
  }
  return out;
}
