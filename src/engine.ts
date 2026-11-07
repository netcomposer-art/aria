/**
 * ARIA's engine: one channel's stream, the playheads that scan it (one Speed lane each), the Ground tables they make,
 * and Energy. Pure: no socket, no timers, no clock of its own (the worker calls tick() with the time), so tests drive
 * it with recordings and simulated time.
 *
 *  - Lane 1 (real time) plays about 25 s behind the newest sample (records arrive in bursts) and never runs past it;
 *    when more than 60 s behind (history streaming in, back from 10×) it jumps to 25 s behind. It always runs: Energy
 *    and ARIA's own views follow it.
 *  - Lanes 10× and 100× run through the stored 30 minutes and loop. A recording loops on every lane.
 *  - Each lane makes a table every TABLE_INTERVAL_MS (5 a second) from the TABLE_SPAN samples ending at its playhead.
 *  - Energy is fed the samples lane 1 passes, so it follows what is heard; Smoothing (one pole) on top. While the
 *    station is offline or quiet, Energy decays to 0 (τ 20 s): the world goes quiet.
 */
import {
  GroundEnergy,
  Smoother,
  TABLE_SPAN,
  type TableSpeed,
  prepareTable,
} from "@netcomposer/nc-situation";
import type { MseedRecord } from "./mseed";
import { StreamBuffer } from "./stream";

export const LIVE_BEHIND_SEC = 25;
export const MAX_BEHIND_SEC = 60;
export const TABLE_INTERVAL_MS = 200;
export const OFFLINE_DECAY_SEC = 20;

export interface LaneTable {
  speed: TableSpeed;
  seq: number;
  samples: Float32Array;
  rms: number;
  /** Seconds behind real time (null: a recording). */
  behindSec: number | null;
}

export interface TickOutput {
  tables: LaneTable[];
  /** The smoothed Energy (null: none yet). */
  energy: number | null;
}

interface Lane {
  ph: number;
  seq: number;
  nextMs: number;
}

export class AriaEngine {
  readonly buffer = new StreamBuffer();
  mode: "none" | "live" | "recording" = "none";
  /** Smoothing, seconds. */
  smoothingSec = 5;
  /** True while the station sends nothing (offline or quiet): Energy decays to 0. */
  silent = false;
  private energy: GroundEnergy | null = null;
  private energyPos = 0;
  private readonly smoother = new Smoother(0);
  private hasEnergy = false;
  private lanes = new Map<TableSpeed, Lane>();
  private epoch = -1;

  constructor() {
    this.lanes.set(1, { ph: Number.NaN, seq: 0, nextMs: 0 });
  }

  /** The Speed lanes that run (1 always). */
  get speeds(): TableSpeed[] {
    return [...this.lanes.keys()];
  }

  setSpeeds(speeds: Iterable<TableSpeed>): void {
    const want = new Set<TableSpeed>([1, ...speeds]);
    for (const s of [...this.lanes.keys()]) if (!want.has(s)) this.lanes.delete(s);
    for (const s of want)
      if (!this.lanes.has(s))
        this.lanes.set(s, { ph: this.lanes.get(1)?.ph ?? Number.NaN, seq: 0, nextMs: 0 });
  }

  /** A live record. */
  add(rec: MseedRecord): void {
    if (this.mode !== "live") this.clear("live");
    this.buffer.append(rec);
  }

  /** Play a recording (its records, in order), looping. */
  loadRecording(recs: MseedRecord[]): void {
    this.clear("recording");
    for (const r of recs) this.buffer.append(r);
  }

  /** Forget the stream (a new station). */
  clear(mode: AriaEngine["mode"] = "none"): void {
    this.buffer.reset();
    this.mode = mode;
  }

  /** Where lane 1 is, as an absolute index (NaN: nowhere yet). */
  get playhead(): number {
    return this.lanes.get(1)!.ph;
  }

  /** Seconds lane 1 is behind real time (null: a recording or nothing yet). */
  behindSec(nowMs: number): number | null {
    const ph = this.playhead;
    if (this.mode !== "live" || !this.buffer.rate || Number.isNaN(ph)) return null;
    return Math.max(0, (nowMs - this.buffer.timeAt(ph)) / 1000);
  }

  /** Seconds since the newest sample (null: nothing yet). */
  newestAgeSec(nowMs: number): number | null {
    if (this.mode !== "live" || !this.buffer.rate) return null;
    return Math.max(0, (nowMs - this.buffer.endMs) / 1000);
  }

  /** Advance by `dtSec` at wall-clock `nowMs`; returns the tables due and the Energy. */
  tick(nowMs: number, dtSec: number, hold = false): TickOutput {
    const b = this.buffer;
    const out: TickOutput = { tables: [], energy: this.hasEnergy ? this.smoother.value : null };
    if (b.epoch !== this.epoch) {
      // A new stream: playheads restart, Energy starts over.
      this.epoch = b.epoch;
      for (const l of this.lanes.values()) l.ph = Number.NaN;
      this.energy = b.rate ? new GroundEnergy({ rate: b.rate }) : null;
      this.energyPos = b.start;
    }
    if (!b.rate || b.data.length < TABLE_SPAN) {
      if (this.silent) this.decay(dtSec, out);
      return out;
    }
    if (!this.energy) {
      this.energy = new GroundEnergy({ rate: b.rate });
      this.energyPos = b.start;
    }
    const looping = this.mode === "recording";
    const first = b.start + TABLE_SPAN;
    for (const [speed, lane] of this.lanes) {
      if (hold) break;
      if (Number.isNaN(lane.ph))
        lane.ph = looping || speed > 1 ? first : Math.max(first, b.end - b.rate * LIVE_BEHIND_SEC);
      if (lane.ph < first) lane.ph = first;
      lane.ph += dtSec * b.rate * speed;
      if (looping || speed > 1) {
        if (lane.ph >= b.end) lane.ph = first;
      } else {
        if (b.end - lane.ph > b.rate * MAX_BEHIND_SEC)
          lane.ph = Math.max(first, b.end - b.rate * LIVE_BEHIND_SEC);
        if (lane.ph > b.end) lane.ph = b.end;
      }
      if (nowMs >= lane.nextMs) {
        lane.nextMs = nowMs + TABLE_INTERVAL_MS;
        const t = prepareTable(b.slice(lane.ph - TABLE_SPAN, lane.ph));
        if (t) {
          const behindSec = looping ? null : Math.max(0, (nowMs - b.timeAt(lane.ph)) / 1000);
          out.tables.push({ speed, seq: ++lane.seq, samples: t.samples, rms: t.rms, behindSec });
        }
      }
    }
    // Energy follows lane 1. A recording loops: when lane 1 wraps, keep feeding from the top.
    const ph = this.lanes.get(1)!.ph;
    if (!hold) {
      if (this.energyPos < b.start) this.energyPos = b.start;
      if (ph < this.energyPos) this.energyPos = b.start; // wrapped
      const levels = this.energy.push(b.slice(this.energyPos, ph));
      this.energyPos = Math.max(this.energyPos, Math.floor(ph));
      if (this.silent) this.decay(dtSec, out);
      else if (levels.length || this.energy.level !== null) {
        const target = this.energy.level ?? 0;
        if (!this.hasEnergy) {
          this.smoother.value = target;
          this.hasEnergy = true;
        } else this.smoother.step(target, dtSec, this.smoothingSec);
        out.energy = this.smoother.value;
      }
    }
    return out;
  }

  private decay(dtSec: number, out: TickOutput): void {
    if (!this.hasEnergy) return;
    out.energy = this.smoother.step(0, dtSec, OFFLINE_DECAY_SEC);
  }

  /**
   * The last `spanSec` seconds of the stream as `cols` columns of min/max (scaled to the span's own peak, −1..1),
   * with where lane 1 and its table window are (0–1 across the strip, NaN when off it).
   */
  overview(
    cols = 600,
    spanSec = 600,
  ): { min: Float32Array; max: Float32Array; playhead: number; window: number } {
    const b = this.buffer;
    const min = new Float32Array(cols);
    const max = new Float32Array(cols);
    if (!b.rate || !b.data.length) return { min, max, playhead: Number.NaN, window: 0 };
    const span = spanSec * b.rate;
    const to = b.end;
    const from = to - span;
    const d = b.slice(from, to);
    const offset = Math.max(0, b.start - from);
    let mean = 0;
    for (const v of d) mean += v;
    mean /= d.length || 1;
    let peak = 0;
    for (const v of d) peak = Math.max(peak, Math.abs(v - mean));
    const per = span / cols;
    for (let c = 0; c < cols; c++) {
      const a = Math.floor(c * per - offset);
      const z = Math.floor((c + 1) * per - offset);
      let lo = 0;
      let hi = 0;
      let any = false;
      for (let i = Math.max(0, a); i < Math.min(d.length, z); i++) {
        const v = (d[i]! - mean) / (peak || 1);
        if (!any) {
          lo = hi = v;
          any = true;
        } else {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      min[c] = lo;
      max[c] = hi;
    }
    const ph = this.playhead;
    return {
      min,
      max,
      playhead: Number.isNaN(ph) ? Number.NaN : (ph - from) / span,
      window: TABLE_SPAN / span,
    };
  }
}
