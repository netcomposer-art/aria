import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TABLE_SIZE } from "@netcomposer/nc-situation";
import { expect, test } from "vitest";
import { AriaEngine, LIVE_BEHIND_SEC } from "../src/engine";
import { type MseedRecord, parseAll } from "../src/mseed";

const b = readFileSync(join(__dirname, "..", "public", "anmo-2010-02-27.mseed"));
const recording = () => parseAll(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));

/** Run the engine for `sec` seconds of wall time in 50 ms ticks. */
function run(e: AriaEngine, startMs: number, sec: number, hold = false) {
  const out = {
    tables: [] as { speed: number; seq: number; behindSec: number | null; samples: Float32Array }[],
    energy: [] as number[],
  };
  for (let t = 0; t < sec * 1000; t += 50) {
    const o = e.tick(startMs + t, 0.05, hold);
    out.tables.push(...o.tables);
    if (o.energy !== null) out.energy.push(o.energy);
  }
  return out;
}

/** The recording's records retimed to end `endAgoMs` before `nowMs` (a live station, as the mock server does). */
function live(nowMs: number, endAgoMs = 6000): MseedRecord[] {
  const recs = recording();
  const shift = nowMs - endAgoMs - (recs.at(-1)!.startMs + (recs.at(-1)!.nsamp / 20) * 1000);
  return recs.map((r) => ({ ...r, startMs: r.startMs + shift }));
}

test("a recording: five tables a second on lane 1, looping, no lag; Energy fills from its history", () => {
  const e = new AriaEngine();
  e.loadRecording(recording());
  const o = run(e, 0, 10);
  const one = o.tables.filter((t) => t.speed === 1);
  expect(one.length).toBeGreaterThanOrEqual(49);
  expect(one.length).toBeLessThanOrEqual(51);
  expect(one.every((t) => t.samples.length === TABLE_SIZE && t.behindSec === null)).toBe(true);
  expect(one.map((t) => t.seq)).toEqual(one.map((_, i) => i + 1));
  expect(o.energy.length).toBeGreaterThan(0);
  expect(o.energy.every((v) => v >= 0 && v <= 1)).toBe(true);
});

test("live: lane 1 plays about 25 s behind the newest sample and reports it", () => {
  const now = Date.UTC(2026, 10, 7, 12);
  const e = new AriaEngine();
  for (const r of live(now)) e.add(r);
  run(e, now, 1);
  const behind = e.behindSec(now + 1000)!;
  expect(behind).toBeGreaterThan(LIVE_BEHIND_SEC);
  expect(behind).toBeLessThan(LIVE_BEHIND_SEC + 8);
  expect(e.newestAgeSec(now)).toBeCloseTo(6, 0);
});

test("Speed lanes: 10× and 100× run and loop through the stored history; dropping a lane stops it", () => {
  const now = Date.UTC(2026, 10, 7, 12);
  const e = new AriaEngine();
  for (const r of live(now)) e.add(r);
  e.setSpeeds([10, 100]);
  const o = run(e, now, 7);
  for (const s of [1, 10, 100])
    expect(o.tables.filter((t) => t.speed === s).length).toBeGreaterThan(30);
  // 100× covers 700 s of a 600 s buffer in 7 s: it looped.
  e.setSpeeds([]);
  expect(e.speeds).toEqual([1]);
  expect(run(e, now + 7000, 1).tables.every((t) => t.speed === 1)).toBe(true);
});

test("Hold: no tables, Energy frozen", () => {
  const e = new AriaEngine();
  e.loadRecording(recording());
  run(e, 0, 3);
  const held = run(e, 3000, 2, true);
  expect(held.tables.length).toBe(0);
  expect(new Set(held.energy).size).toBeLessThanOrEqual(1);
});

test("silent (offline or quiet): Energy decays toward 0", () => {
  const e = new AriaEngine();
  e.loadRecording(recording());
  const before = run(e, 0, 5).energy.at(-1)!;
  e.silent = true;
  const after = run(e, 5000, 20).energy.at(-1)!;
  expect(after).toBeLessThan(before * 0.45);
});

test("overview: 600 columns of min/max in −1..1, the playhead on the strip", () => {
  const e = new AriaEngine();
  e.loadRecording(recording());
  run(e, 0, 1);
  const o = e.overview();
  expect(o.min.length).toBe(600);
  expect(Math.max(...o.max)).toBeLessThanOrEqual(1);
  expect(Math.min(...o.min)).toBeGreaterThanOrEqual(-1);
  expect(o.playhead).toBeGreaterThan(0);
  expect(o.playhead).toBeLessThanOrEqual(1);
});
