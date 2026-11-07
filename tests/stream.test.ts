import { expect, test } from "vitest";
import type { MseedRecord } from "../src/mseed";
import { KEEP_SEC, StreamBuffer, decimate } from "../src/stream";

const rec = (
  startMs: number,
  n: number,
  rate = 20,
  v = (i: number) => i,
  cha = "BHZ",
): MseedRecord => ({
  net: "IU",
  sta: "ANMO",
  loc: "00",
  cha,
  startMs,
  rate,
  nsamp: n,
  encoding: 11,
  recLen: 512,
  samples: Float64Array.from({ length: n }, (_, i) => v(i)),
});

test("contiguous records append; overlaps keep only the new tail; small gaps hold the last value", () => {
  const b = new StreamBuffer();
  b.append(rec(0, 20));
  b.append(rec(1000, 20, 20, (i) => 100 + i));
  expect(b.data.length).toBe(40);
  b.append(rec(1500, 20, 20, (i) => 200 + i)); // overlaps by 10
  expect(b.data.length).toBe(50);
  expect(b.data[40]).toBe(210);
  b.append(rec(3500, 20)); // a 1 s gap
  expect(b.data.length).toBe(90);
  expect(b.data[60]).toBe(219);
  expect(b.endMs).toBe(4500);
});

test("a long gap or another channel starts over (a new epoch)", () => {
  const b = new StreamBuffer();
  b.append(rec(0, 20));
  const e = b.epoch;
  b.append(rec(120_000, 20));
  expect(b.epoch).toBe(e + 1);
  expect(b.data.length).toBe(20);
  b.append(rec(121_000, 20, 20, (i) => i, "BHN"));
  expect(b.epoch).toBe(e + 2);
});

test("30 minutes kept; positions are absolute", () => {
  const b = new StreamBuffer();
  for (let s = 0; s < KEEP_SEC + 60; s += 10) b.append(rec(s * 1000, 200));
  expect(b.data.length).toBe(KEEP_SEC * 20);
  expect(b.start).toBe(60 * 20);
  expect(b.timeAt(b.start)).toBe(60_000);
  expect(Array.from(b.slice(b.end - 3, b.end + 5))).toEqual([197, 198, 199]);
});

test("fast channels are averaged down to about 20 samples/s", () => {
  expect(Array.from(decimate(Float64Array.from([1, 3, 5, 7, 9]), 2))).toEqual([2, 6]);
  const b = new StreamBuffer();
  b.append(rec(0, 2000, 200));
  expect(b.rate).toBe(20);
  expect(b.data.length).toBe(200);
});
