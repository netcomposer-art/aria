import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseAll } from "../src/mseed";

const dir = join(__dirname, "fixtures");
const ref = JSON.parse(readFileSync(join(dir, "obspy-ref.json"), "utf8")) as {
  obspy: string;
  files: Record<string, { id: string; start: number; rate: number; data: number[] }[]>;
};
const buf = (f: string) => {
  const b = readFileSync(f);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
};

describe(`miniSEED reader against ObsPy ${ref.obspy}`, () => {
  for (const [file, traces] of Object.entries(ref.files)) {
    test(file, () => {
      const recs = parseAll(buf(join(dir, file)));
      for (const t of traces) {
        const rs = recs
          .filter((r) => [r.net, r.sta, r.loc, r.cha].join(".") === t.id)
          .sort((a, b) => a.startMs - b.startMs);
        const data = rs.flatMap((r) => Array.from(r.samples));
        expect(data.length).toBe(t.data.length);
        if (file.startsWith("Float32"))
          for (let i = 0; i < data.length; i++) expect(data[i]).toBeCloseTo(t.data[i]!, 5);
        else expect(data).toEqual(t.data);
        // Start time to the millisecond (ObsPy applies an unapplied time correction too).
        expect(Math.abs(rs[0]!.startMs - t.start)).toBeLessThan(1);
        expect(Math.abs(rs[0]!.rate - t.rate) / t.rate).toBeLessThan(1e-4);
      }
    });
  }
});

test("the bundled 2010 recording: 30 records, ten minutes of IU.ANMO.00.BHZ at 20 samples/s", () => {
  const recs = parseAll(buf(join(__dirname, "..", "public", "anmo-2010-02-27.mseed")));
  expect(recs.length).toBe(30);
  expect(new Set(recs.map((r) => `${r.net}.${r.sta}.${r.loc}.${r.cha}`))).toEqual(
    new Set(["IU.ANMO.00.BHZ"]),
  );
  expect(recs[0]!.rate).toBe(20);
  expect(recs.reduce((n, r) => n + r.nsamp, 0)).toBe(12000);
});

test("not a record: a clear error", () => {
  expect(() => parseAll(new Uint8Array(512).buffer)).toThrow(/miniSEED/);
});
