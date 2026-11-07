// nc-ui tapers: how a slider's travel maps to its value (Peter, 2026-11-01: "the sliders are biased very much to the
// left side, so big changes happen with little movement in the first section, and the changes are much finer as you
// move to the right"). A linear 0..5 s Attack spends its first quarter on 0..1.25 s, which is nearly every attack
// anyone plays; a linear 20..800 Hz Tune spends it on 20..215 Hz. A taper spreads the travel by what the ear hears.
//
// One small set, shared by every app (ASTRID vendors this file unchanged):
//   linear, percent, db, bipolar   equal travel = equal value (percentages, dB, cents, semitones, pan)
//   freq, q, rate                  logarithmic (min > 0); with a 0 floor ("off") a cube taper instead
//   time                           min > 0: logarithmic; from 0: value = min + (max - min) * x^3
// Only where the knob sits changes: values, saves, defaults and double-click reset are untouched.
// Self-contained (no imports). nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.

/** Positions a tapered range input runs in (0..TAPER_STEPS, step 1). */
export const TAPER_STEPS = 1000;
/** The taper names. */
export const TAPERS = Object.freeze(["linear", "percent", "db", "bipolar", "time", "freq", "q", "rate"]);
/** The power used from a 0 floor (time from 0 ms, a frequency whose 0 means off). */
export const TAPER_POWER = 3;

const LOGS = new Set(["freq", "q", "rate", "time", "log"]);

/** The curve a taper uses on a range: "linear", "log" or "power". */
export function taperCurve(taper, min, max) {
  if (!taper || !LOGS.has(taper)) return "linear";
  if (!(max > min)) return "linear";
  return min > 0 ? "log" : "power";
}

/** True when the taper moves the knob differently from a plain linear range. */
export function isTapered(taper, min, max) {
  return taperCurve(taper, min, max) !== "linear";
}

/** A value to its share of the travel (0..1), clamped. */
export function taperToUnit(taper, min, max, value) {
  const v = Number(value);
  if (!(max > min) || !Number.isFinite(v)) return 0;
  const c = Math.min(max, Math.max(min, v));
  const curve = taperCurve(taper, min, max);
  if (curve === "log") return Math.log(c / min) / Math.log(max / min);
  const t = (c - min) / (max - min);
  return curve === "power" ? Math.cbrt(t) : t;
}

/** A share of the travel (0..1) to its value, unrounded. */
export function taperFromUnit(taper, min, max, unit) {
  const x = Math.min(1, Math.max(0, Number(unit) || 0));
  const curve = taperCurve(taper, min, max);
  if (curve === "log") return min * (max / min) ** x;
  return min + (max - min) * (curve === "power" ? x ** TAPER_POWER : x);
}

/** Round to the slider's step from min (a step of 0 or none keeps the value), without float dust. */
export function snapToStep(value, min, max, step) {
  let v = Math.min(max, Math.max(min, value));
  if (step > 0) {
    v = min + Math.round((v - min) / step) * step;
    const digits = Math.min(12, Math.max(0, Math.ceil(-Math.log10(step)) + 1));
    v = Number(v.toFixed(digits));
    v = Math.min(max, Math.max(min, v));
  }
  return v;
}

/** A value to a range-input position (0..TAPER_STEPS, whole). */
export function taperPosition(taper, min, max, value) {
  return Math.round(taperToUnit(taper, min, max, value) * TAPER_STEPS);
}

/** A range-input position to its value, snapped to `step` (when given). */
export function taperValue(taper, min, max, position, step) {
  return snapToStep(taperFromUnit(taper, min, max, Number(position) / TAPER_STEPS), min, max, step);
}

/**
 * Keyboard on a tapered range input: arrows move 1% of the travel (Shift 0.1%), Page Up/Down 10%, Home/End the ends.
 * Returns the new position, or null for any other key.
 */
export function taperKeyPosition(position, key, shift = false) {
  const p = Number(position) || 0;
  const fine = shift ? 1 : TAPER_STEPS / 100;
  let next = null;
  if (key === "ArrowRight" || key === "ArrowUp") next = p + fine;
  else if (key === "ArrowLeft" || key === "ArrowDown") next = p - fine;
  else if (key === "PageUp") next = p + TAPER_STEPS / 10;
  else if (key === "PageDown") next = p - TAPER_STEPS / 10;
  else if (key === "Home") next = 0;
  else if (key === "End") next = TAPER_STEPS;
  return next === null ? null : Math.min(TAPER_STEPS, Math.max(0, Math.round(next)));
}

/**
 * A key on a tapered control, from its value: the next value by travel (taperKeyPosition), snapped to `step`. When the
 * step is coarse at that end of the travel (whole milliseconds near 1 ms), it keeps going until the value changes, so a
 * key always moves. Returns the new value, or null for any other key.
 */
export function taperKeyValue(taper, min, max, value, key, shift = false, step) {
  const from = taperPosition(taper, min, max, value);
  let next = taperKeyPosition(from, key, shift);
  if (next === null) return null;
  let v = taperValue(taper, min, max, next, step);
  const dir = Math.sign(next - from);
  const current = snapToStep(Number(value), min, max, step);
  while (dir !== 0 && v === current && next > 0 && next < TAPER_STEPS) {
    next += dir;
    v = taperValue(taper, min, max, next, step);
  }
  return v;
}

/**
 * The taper for an nc-fx catalog dial (its own `taper` if it has one): option dials none; `curve: "log"` a frequency;
 * a millisecond dial (unit "ms", or a key ending "_ms", or the plate's pre-delay) a time; everything else linear.
 * The catalog's frequency, Q, rate and ratio dials already run 0..100 through their own log laws, so they stay linear.
 */
export function dialTaper(dial) {
  if (!dial || dial.options) return "linear";
  if (typeof dial.taper === "string") return dial.taper;
  if (dial.curve === "log") return "freq";
  if (dial.unit === "ms" || /_ms$/.test(String(dial.key ?? "")) || dial.key === "predelay") return "time";
  return "linear";
}
