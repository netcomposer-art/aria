/**
 * ARIA's settings: the station, Smoothing and Hold. Saved in this browser (per instance), in the Studio's Scenes (its
 * preset) and in a file (Save / Load). Old saves always load: unknown or bad fields fall back to the defaults.
 */
import { DEFAULT_PRESET, PRESETS } from "./stations";

export const FORMAT = "netcomposer.aria";
export const VERSION = 1;

export interface AriaState {
  /** A preset id, "custom" (typed) or "recording" (the bundled 2010 recording). */
  station: string;
  /** "NET STA LOC CHA" for custom. */
  custom: string;
  /** Energy Smoothing, seconds (0.5–30). */
  smoothing: number;
  hold: boolean;
}

export const DEFAULTS: AriaState = {
  station: DEFAULT_PRESET,
  custom: "IU ANMO 00 BHZ",
  smoothing: 5,
  hold: false,
};
export const SMOOTHING_MIN = 0.5;
export const SMOOTHING_MAX = 30;

export function sanitize(raw: unknown): AriaState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof AriaState, unknown>
  >;
  const station =
    typeof r.station === "string" &&
    (r.station === "custom" || r.station === "recording" || PRESETS.some((p) => p.id === r.station))
      ? r.station
      : DEFAULTS.station;
  const custom = typeof r.custom === "string" && r.custom.length <= 40 ? r.custom : DEFAULTS.custom;
  const s =
    typeof r.smoothing === "number" && Number.isFinite(r.smoothing)
      ? r.smoothing
      : DEFAULTS.smoothing;
  return {
    station,
    custom,
    smoothing: Math.min(SMOOTHING_MAX, Math.max(SMOOTHING_MIN, s)),
    hold: r.hold === true,
  };
}

/** The settings as a file (Save) or a Studio preset. */
export function presetFile(s: AriaState) {
  return { format: FORMAT, version: VERSION, settings: { ...s } };
}

/** Settings from a file or preset, or null when it isn't one of ARIA's. */
export function readPreset(raw: unknown): AriaState | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as { format?: unknown; version?: unknown; settings?: unknown };
  if (f.format !== FORMAT || typeof f.version !== "number" || f.version > VERSION) return null;
  return sanitize(f.settings);
}
