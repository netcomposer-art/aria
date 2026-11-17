import { MotionShaper } from "@netcomposer/nc-situation";
import { describe, expect, it } from "vitest";
import {
  Bucket,
  CODE_ALPHABET,
  admit,
  checkMessage,
  cleanName,
  cleanToken,
  formatCode,
  normalizeCode,
  randomCode,
} from "../relay/src/room";
import { qrSvg } from "../src/qr";
import {
  Delay,
  TAP_JOLT_MS2,
  delayText,
  packReading,
  pairLink,
  unpackReading,
} from "../src/remote-link";

describe("pairing codes", () => {
  it("reads codes however they are typed, and nothing else", () => {
    expect(normalizeCode("k7 4q")).toBe("K74Q");
    expect(normalizeCode("#K7-4Q")).toBe("K74Q");
    expect(normalizeCode("K7O4")).toBeNull(); // O is not in the alphabet
    expect(normalizeCode("K74")).toBeNull();
    expect(normalizeCode(undefined)).toBeNull();
    expect(formatCode("K74Q")).toBe("K7 4Q");
  });
  it("makes codes from the 31 unambiguous letters, evenly", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const c = randomCode();
      expect(normalizeCode(c)).toBe(c);
      for (const ch of c) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(counts.size).toBe(CODE_ALPHABET.length);
    for (const n of counts.values()) expect(n).toBeGreaterThan(150); // 8000 / 31 ≈ 258
    // bytes ≥ 248 are skipped (no bias towards the first letters)
    expect(randomCode(new Uint8Array([248, 0, 1, 2, 3]))).toBe("ABCD");
  });
  it("cleans the names and tokens it passes on", () => {
    expect(cleanName("Peter's <b>iPhone</b>\u0007", "x")).toBe("Peter's biPhone/b");
    expect(cleanName("   ", "Phone")).toBe("Phone");
    expect(cleanName("x".repeat(80), "y")).toHaveLength(40);
    expect(cleanToken("abcDEF12")).toBe("abcDEF12");
    expect(cleanToken("short")).toBeNull();
    expect(cleanToken("bad token!")).toBeNull();
  });
});

describe("who may join a room", () => {
  const studio = { role: "studio" as const, token: "studio-1" };
  const phone = { role: "phone" as const, token: "phone-1" };
  it("a Studio opens a free room; a second Studio is refused", () => {
    expect(admit(studio, [])).toEqual({ ok: true, replace: [] });
    expect(admit({ role: "studio", token: "studio-2" }, [studio])).toEqual({
      ok: false,
      why: "taken",
    });
  });
  it("a phone needs a Studio, and only one phone at a time", () => {
    expect(admit(phone, [])).toEqual({ ok: false, why: "no-studio" });
    expect(admit(phone, [studio])).toEqual({ ok: true, replace: [] });
    expect(admit({ role: "phone", token: "phone-2" }, [studio, phone])).toEqual({
      ok: false,
      why: "busy",
    });
  });
  it("the same tab reconnecting replaces its own stale socket", () => {
    expect(admit(phone, [studio, phone])).toEqual({ ok: true, replace: [1] });
    expect(admit(studio, [studio, phone])).toEqual({ ok: true, replace: [0] });
  });
});

describe("what the relay passes on", () => {
  it("only small JSON messages of the known kinds", () => {
    expect(checkMessage('{"k":"m","t":1}')).toBe('{"k":"m","t":1}');
    expect(checkMessage('{"k":"admin"}')).toBeNull();
    expect(checkMessage("[1,2]")).toBeNull();
    expect(checkMessage("not json")).toBeNull();
    expect(checkMessage(`{"k":"m","x":"${"y".repeat(700)}"}`)).toBeNull();
    expect(checkMessage(42)).toBeNull();
  });
  it("a token bucket per socket drops a flood", () => {
    const b = new Bucket(150, 300, 0);
    let ok = 0;
    for (let i = 0; i < 1000; i++) if (b.take(0)) ok++;
    expect(ok).toBe(300);
    expect(b.dropped).toBe(700);
    // a phone's steady 60 readings a second always pass
    const steady = new Bucket(150, 300, 0);
    let passed = 0;
    for (let i = 0; i < 600; i++) if (steady.take((i * 1000) / 60)) passed++;
    expect(passed).toBe(600);
  });
});

describe("readings on the wire", () => {
  const r = {
    t: 12.34567,
    beta: 35.123,
    gamma: -4.567,
    heading: 227.04,
    accel: { x: 0.123, y: -0.456, z: 9.81 },
    accelG: null,
    screenAngle: 90,
  };
  it("round-trips a reading, rounded, in a small message", () => {
    const text = packReading(r);
    expect(text.length).toBeLessThan(160);
    expect(checkMessage(text)).toBe(text);
    const back = unpackReading(JSON.parse(text));
    expect(back).toEqual({
      t: 12.3457,
      beta: 35.12,
      gamma: -4.57,
      heading: 227,
      accel: { x: 0.12, y: -0.46, z: 9.81 },
      accelG: null,
      screenAngle: 90,
      tap: false,
    });
    expect(unpackReading({ k: "s" })).toBeNull();
  });
  it("Tap = Shake arrives as a shake the Studio's shaper hears", () => {
    const shaper = new MotionShaper();
    shaper.step({ ...r, t: 1, accel: { x: 0, y: 0, z: 0 } });
    const tap = unpackReading(
      JSON.parse(packReading({ ...r, t: 1.1, accel: { x: 0, y: 0, z: TAP_JOLT_MS2 } }, true)),
    )!;
    expect(tap.tap).toBe(true);
    const step = shaper.step(tap);
    expect(step.shake).not.toBeNull();
    expect(step.values.shake).toBeGreaterThan(0.7);
  });
  it("the pairing link carries the code in the hash", () => {
    expect(pairLink("https://netcomposer.art", "K74Q")).toBe(
      "https://netcomposer.art/remote/#K74Q",
    );
  });
});

describe("the delay", () => {
  it("is half the median round trip, and the clock offset follows the pong", () => {
    const d = new Delay();
    expect(d.ms).toBeNull();
    // phone clock = studio clock + 5000 ms; one way 40 ms
    for (let i = 0; i < 5; i++) d.pong(1000 * i, 1000 * i + 40 + 5000, 1000 * i + 80);
    d.pong(6000, 6000 + 40 + 5000, 6000 + 400); // one slow round trip doesn't move the median
    expect(d.ms).toBe(40);
    expect(Math.round(d.offset!)).toBe(5000 - 160);
  });
  it("jitter is the spread of reading transit times", () => {
    const d = new Delay();
    d.pong(0, 5040, 80);
    for (let i = 0; i < 20; i++) d.reading(5000 + i * 16, 40 + i * 16 + (i % 2 ? 6 : 0));
    expect(d.jitter).toBeCloseTo(3, 0);
    expect(delayText(38.2, 6.4)).toBe("38 ms ± 6");
    expect(delayText(null)).toBe("measuring…");
  });
});

describe("the pairing QR code", () => {
  it("draws the link as black squares on white, with no QR service", () => {
    const svg = qrSvg("https://netcomposer.art/remote/#K74Q");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="#fff"');
    expect((svg.match(/h1v1h-1z/g) ?? []).length).toBeGreaterThan(200);
  });
});
