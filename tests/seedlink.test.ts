import { expect, test } from "vitest";
import { accepted, backoffMs, dataFrame, handshake, parseChannel, wire } from "../src/seedlink";

test("handshake: HELLO, STATION, SELECT, TIME ten minutes back, END", () => {
  const now = Date.UTC(2026, 10, 7, 12, 30, 5);
  expect(handshake({ net: "IU", sta: "ANMO", loc: "00", cha: "BHZ" }, now)).toEqual([
    "HELLO",
    "STATION ANMO IU",
    "SELECT 00BHZ.D",
    "TIME 2026,11,07,12,20,05",
    "END",
  ]);
  expect(handshake({ net: "OO", sta: "AXCC1", loc: "", cha: "HHZ" }, now)[2]).toBe("SELECT HHZ.D");
  expect(handshake({ net: "XX", sta: "A", loc: "--", cha: "BHZ" }, now)[2]).toBe("SELECT BHZ.D");
  expect(wire("HELLO")).toBe("HELLO\r");
  expect(wire("STATION ANMO IU")).toBe("STATION ANMO IU\r\n");
});

test("data frames: SL + six hex digits + a record", () => {
  const b = new Uint8Array(8 + 512);
  b.set([83, 76, ...Array.from("00001F", (c) => c.charCodeAt(0))]);
  const f = dataFrame(b)!;
  expect(f.seq).toBe(31);
  expect(f.record.byteLength).toBe(512);
  expect(f.record.byteOffset).toBe(8);
  expect(dataFrame(new TextEncoder().encode("OK\r\n"))).toBeNull();
  const bad = b.slice();
  bad[3] = 90;
  expect(dataFrame(bad)).toBeNull();
  expect(accepted("OK\r\n")).toBe(true);
  expect(accepted("ERROR\r\n")).toBe(false);
});

test("typed channels", () => {
  expect(parseChannel("iu anmo 00 bhz")).toEqual({ net: "IU", sta: "ANMO", loc: "00", cha: "BHZ" });
  expect(parseChannel("IU.HRV")).toEqual({ net: "IU", sta: "HRV", loc: "00", cha: "BHZ" });
  expect(parseChannel("IU")).toBeNull();
  expect(parseChannel("IU ANMO 00 BHZ X")).toBeNull();
  expect(parseChannel("IU ANMO; DROP")).toBeNull();
});

test("backoff: 3, 6, 12, 24, 48, then 60 s, ±20 %", () => {
  expect([1, 2, 3, 4, 5, 6, 9].map((n) => backoffMs(n, 0.5))).toEqual([
    3000, 6000, 12000, 24000, 48000, 60000, 60000,
  ]);
  expect(backoffMs(1, 0)).toBe(2400);
  expect(backoffMs(1, 1)).toBe(3600);
});
