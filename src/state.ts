/**
 * ARIA's settings: the station, Smoothing, Hold and My phone's settings (Peter, 2026-11-14). Saved in this browser (per instance), in the Studio's Scenes (its
 * preset) and in a file (Save / Load). Old saves always load: unknown or bad fields fall back to the defaults.
 */
import { type MotionSettings, sanitizeMotionSettings } from "@netcomposer/nc-situation";
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
  /** My phone: Smooth, the centre, Invert X / Y, and whether motion is wanted on (a tap on Allow motion). */
  motion: PhoneSettings;
}

export interface PhoneSettings extends MotionSettings {
  /** The player turned motion on (Allow motion) and not off. On a phone that must ask, a tap still starts it. */
  on: boolean;
  /** When the centre was last set (epoch ms), or null: the default centre. */
  centredAt: number | null;
}

export const DEFAULTS: AriaState = {
  station: DEFAULT_PRESET,
  custom: "IU ANMO 00 BHZ",
  smoothing: 5,
  hold: false,
  motion: { ...sanitizeMotionSettings(null), on: false, centredAt: null },
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
    motion: sanitizePhone(r.motion),
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

/** My phone's settings, checked (an old save without them gets the defaults: motion off). */
export function sanitizePhone(raw: unknown): PhoneSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const at = r.centredAt;
  return {
    ...sanitizeMotionSettings(raw),
    on: r.on === true,
    centredAt: typeof at === "number" && Number.isFinite(at) && at > 0 ? at : null,
  };
}
