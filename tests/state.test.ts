import { expect, test } from "vitest";
import { DEFAULTS, presetFile, readPreset, sanitize } from "../src/state";
import { PRESETS, credit } from "../src/stations";

test("old or broken settings load as the defaults, field by field", () => {
  expect(sanitize(null)).toEqual(DEFAULTS);
  expect(sanitize({ station: "nowhere", smoothing: 999, hold: "yes" })).toEqual({
    ...DEFAULTS,
    smoothing: 30,
  });
  expect(sanitize({ station: "qspa", smoothing: 2 }).station).toBe("qspa");
});

test("presets round-trip; another app's file is refused", () => {
  const s = { ...DEFAULTS, station: "custom", custom: "IU COLA 00 BHZ", smoothing: 3, hold: true };
  expect(readPreset(JSON.parse(JSON.stringify(presetFile(s))))).toEqual(s);
  expect(readPreset({ format: "netcomposer.generator", version: 1, settings: {} })).toBeNull();
  expect(readPreset({ format: "netcomposer.aria", version: 2, settings: {} })).toBeNull();
});

test("six presets; every one but ANMO and HRV has a fallback; credits cite the network DOI", () => {
  expect(PRESETS.map((p) => p.id)).toEqual(["anmo", "hrv", "poha", "axial", "qspa", "tato"]);
  for (const p of PRESETS.slice(2)) expect(p.fallback).toBeTruthy();
  expect(credit("IU")).toContain("doi:10.7914/SN/IU");
  expect(credit("IU")).toContain("EarthScope");
  expect(credit("ZZ")).toContain("fdsn.org/networks/detail/ZZ");
});

test("My phone: an old save loads with motion off and the defaults; its settings round-trip in a preset", () => {
  expect(sanitize({ station: "hrv", smoothing: 2 }).motion).toEqual(DEFAULTS.motion);
  expect(DEFAULTS.motion.on).toBe(false);
  const s = {
    ...DEFAULTS,
    motion: {
      on: true,
      smooth: 0.55,
      centre: { pitch: 48, roll: -3 },
      centredAt: 1_763_000_000_000,
      invertX: false,
      invertY: true,
    },
  };
  expect(readPreset(JSON.parse(JSON.stringify(presetFile(s))))).toEqual(s);
  expect(sanitize({ motion: { smooth: 9, on: "yes", centredAt: -4 } }).motion).toEqual({
    ...DEFAULTS.motion,
    smooth: 1,
  });
});
