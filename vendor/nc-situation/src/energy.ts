/**
 * Ground Energy: how much a seismometer's ground is moving, as 0–1, against that station's own normal.
 *
 *  - The signal is high-passed (one pole, 0.05 Hz) to drop the sensor's offset and slow drift.
 *  - Every second of samples gives one RMS over the last `windowSec` (10 s).
 *  - The baseline is the median of those RMS values over the last `baselineSec` (30 minutes): it auto-ranges, so a
 *    quiet station (the South Pole) still moves and a busy one (a city by day) doesn't sit at the top.
 *  - Level = 0.5 + 0.25 · log2(rms / baseline), clamped to 0–1: the station's normal reads 0.5, four times louder 1,
 *    four times quieter 0.
 *
 * Pure and deterministic: the same samples always give the same levels (a later replay depends on it).
 */

/** The Energy level for an RMS against a baseline, 0–1. */
export function energyLevel(rms: number, baseline: number): number {
  if (!(rms > 0)) return 0;
  if (!(baseline > 0)) return 0.5;
  const x = 0.5 + 0.25 * Math.log2(rms / baseline);
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** The median of the values (copied, then sorted); NaN for none. */
export function median(values: ArrayLike<number>): number {
  const n = values.length;
  if (!n) return Number.NaN;
  const a = Float64Array.from(values as ArrayLike<number>).sort();
  return n % 2 ? a[(n - 1) / 2]! : (a[n / 2 - 1]! + a[n / 2]!) / 2;
}

export interface GroundEnergyOptions {
  /** Samples per second of the input. */
  rate: number;
  /** RMS window, seconds (default 10). */
  windowSec?: number;
  /** Baseline span, seconds (default 1800: 30 minutes). */
  baselineSec?: number;
  /** High-pass corner, Hz (default 0.05). */
  highpassHz?: number;
}

/** Turns a stream of samples into one Energy level per second of input. */
export class GroundEnergy {
  readonly rate: number;
  private readonly windowSec: number;
  private readonly baselineMax: number;
  private readonly a: number;
  private xPrev = Number.NaN;
  private y = 0;
  /** Sum of squares per whole second, the last `windowSec` of them. */
  private seconds: number[] = [];
  private acc = 0;
  private count = 0;
  private perSecond: number;
  private history: number[] = [];
  /** The latest values (null until the first second). */
  rms: number | null = null;
  baseline: number | null = null;
  level: number | null = null;

  constructor(o: GroundEnergyOptions) {
    if (!(o.rate > 0)) throw new Error("GroundEnergy: rate must be positive");
    this.rate = o.rate;
    this.windowSec = Math.max(1, Math.round(o.windowSec ?? 10));
    this.baselineMax = Math.max(1, Math.round(o.baselineSec ?? 1800));
    const rc = 1 / (2 * Math.PI * (o.highpassHz ?? 0.05));
    this.a = rc / (rc + 1 / this.rate);
    this.perSecond = Math.max(1, Math.round(this.rate));
  }

  /**
   * Feed samples in order. Returns the levels produced (one per whole second of input), oldest first; usually none
   * or one per call.
   */
  push(samples: ArrayLike<number>): number[] {
    const out: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i]!;
      if (!Number.isFinite(x)) continue;
      if (Number.isNaN(this.xPrev)) this.xPrev = x;
      this.y = this.a * (this.y + x - this.xPrev);
      this.xPrev = x;
      this.acc += this.y * this.y;
      if (++this.count >= this.perSecond) {
        this.seconds.push(this.acc / this.count);
        if (this.seconds.length > this.windowSec) this.seconds.shift();
        this.acc = 0;
        this.count = 0;
        const rms = Math.sqrt(this.seconds.reduce((s, v) => s + v, 0) / this.seconds.length);
        this.history.push(rms);
        if (this.history.length > this.baselineMax) this.history.shift();
        this.rms = rms;
        this.baseline = median(this.history);
        this.level = energyLevel(rms, this.baseline);
        out.push(this.level);
      }
    }
    return out;
  }

  /** Forget everything (a new station, or a gap too long to bridge). */
  reset(): void {
    this.xPrev = Number.NaN;
    this.y = 0;
    this.seconds = [];
    this.acc = 0;
    this.count = 0;
    this.history = [];
    this.rms = this.baseline = this.level = null;
  }
}

/**
 * One-pole smoothing (Smoothing, τ seconds), the archived Situation engine's `conditionedValue` formula:
 * value += (target − value)(1 − e^(−dt/τ)). τ 0 follows at once.
 */
export class Smoother {
  value: number;
  constructor(initial = 0) {
    this.value = initial;
  }
  step(target: number, dtSec: number, tauSec: number): number {
    if (!(tauSec > 0)) this.value = target;
    else this.value += (target - this.value) * (1 - Math.exp(-Math.max(0, dtSec) / tauSec));
    return this.value;
  }
}
