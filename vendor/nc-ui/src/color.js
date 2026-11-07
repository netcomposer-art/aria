// nc-ui colour helpers: WCAG contrast, label pick, and the Surprise fill.
// Pure functions, no DOM, no dependencies. Ported unchanged in behaviour from
// ASTRID lib/synth-audio/src/surprise.ts (same maths, same random draws).
// nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.
import { semantic, component, constants, cssVar, themes } from '../dist/tokens.js';

/** Label colours: the near-black label ink, or white (tokens label-on-fill-dark / -light). */
export const INK_DARK = semantic['label-on-fill-dark'];
export const INK_LIGHT = semantic['label-on-fill-light'];
/** WCAG AA for small text. */
export const MIN_LABEL_CONTRAST = constants['label-min-contrast'];

const HEX = /^#[0-9a-f]{6}$/i;
/** @param {unknown} v @returns {v is string} */
export const isHexColor = (v) => typeof v === 'string' && HEX.test(v);
const hex2 = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** HSL (h in degrees, s and l 0..1) to #rrggbb. */
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return `#${hex2(f(0) * 255)}${hex2(f(8) * 255)}${hex2(f(4) * 255)}`;
}
/** #rrggbb to HSL (h degrees, s and l 0..1). */
export function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}
/** WCAG relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio of two #rrggbb colours (1..21). */
export function contrastRatio(a, b) {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** The label colour (dark ink or white) with the higher contrast on `fill`. Pure. */
export const labelColorFor = (fill) =>
  contrastRatio(fill, INK_DARK) >= contrastRatio(fill, INK_LIGHT) ? INK_DARK : INK_LIGHT;

/** Nudge lightness until the better label clears `min` (lighter for dark ink, darker for white). */
export function readable(h, s, l, min = MIN_LABEL_CONTRAST) {
  let hex = hslToHex(h, s, l);
  const dir = labelColorFor(hex) === INK_DARK ? 1 : -1;
  for (let i = 0; i < 40 && contrastRatio(hex, labelColorFor(hex)) < min; i++) { l += dir * 0.01; hex = hslToHex(h, s, l); }
  return hex;
}

/** Fill + label, and a deep shade of it (+ label) for the active slot. */
export function slotColors(fill) {
  const { h, s } = hexToHsl(fill);
  const on = readable(h, Math.min(s, constants['surprise-on-max-saturation']), constants['surprise-on-lightness']);
  return { fill, ink: labelColorFor(fill), on, onInk: labelColorFor(on) };
}

const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
/** A bright fill (saturation 85-100 %, lightness 50-60 %) at least 60 degrees round the wheel from `previous`. */
export function surpriseColor(previous, random = Math.random) {
  const [s0, s1] = constants['surprise-saturation'], [l0, l1] = constants['surprise-lightness'];
  const gap = constants['surprise-min-hue-gap'];
  const last = isHexColor(previous) ? hexToHsl(previous).h : null;
  let h = random() * 360;
  if (last !== null && hueGap(h, last) < gap) h = (last + gap + random() * (360 - 2 * gap)) % 360;
  return readable(h, s0 + random() * (s1 - s0), l0 + random() * (l1 - l0));
}

/** The runtime surprise-* custom properties for a fill (set them on the slot row). null = defaults. */
export function surpriseFillStyle(fill) {
  if (!fill) return null;
  const c = slotColors(fill);
  return { [cssVar('surprise-fill')]: c.fill, [cssVar('surprise-ink')]: c.ink, [cssVar('surprise-on')]: c.on, [cssVar('surprise-on-ink')]: c.onInk };
}

// Velocity shade (Rhythm steps and pads, reusable by Bass). One ramp in the accent's hue: velocity 1.0 is the accent
// (#003153, rhythm.velocity-max), velocity 0.05 is rhythm.velocity-min, linear in OKLab in between (even lightness
// steps, the hue held). Pure and JSON in, JSON out.
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
/** #rrggbb to OKLab [L, a, b]. */
export function hexToOklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
/** OKLab [L, a, b] to #RRGGBB (clipped to sRGB). */
export function oklabToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb.map((c) => hex2(linearToSrgb(Math.max(0, Math.min(1, c))) * 255)).join('')}`.toUpperCase();
}

/** [quietest, loudest] velocity (tokens constant velocity-range: 0.05, 1). */
export const VELOCITY_RANGE = constants['velocity-range'];
/** The default ramp: rhythm.velocity-min (light end) to rhythm.velocity-max (#003153, dark end). */
export const VELOCITY_RAMP = { min: component.rhythm['velocity-min'], max: component.rhythm['velocity-max'] };
/** The ramp per theme, with the mark colour on it (rhythm.step-cell-ink). Pass VELOCITY_RAMPS[currentTheme()]. */
export const VELOCITY_RAMPS = Object.fromEntries(Object.entries(themes).map(([name, t]) =>
  [name, { min: t.component.rhythm['velocity-min'], max: t.component.rhythm['velocity-max'], ink: t.component.rhythm['step-cell-ink'] }]));

/**
 * The fill of an on step (or pad) at `velocity`.
 * @param {number} velocity 0.05..1 (clamped; anything not a finite number counts as the quietest, 0.05)
 * @param {{ min: string, max: string, ink?: string }} [ramp] #rrggbb ends (and the mark colour); defaults to VELOCITY_RAMP
 *   (the light rhythm tokens). VELOCITY_RAMPS.dark is the dark theme's
 * @returns {{ velocity: number, t: number, fill: string, ink: string }} the clamped velocity, its place on the ramp
 *   (0 at 0.05, 1 at 1.0), the fill (#RRGGBB; exactly ramp.min at 0.05 and ramp.max at 1.0) and the mark colour
 *   on it (rhythm.step-cell-ink, paper; at least 4.5:1 on every fill of the default ramp).
 */
export function velocityFill(velocity, ramp = VELOCITY_RAMP) {
  const [lo, hi] = VELOCITY_RANGE;
  const v = Number.isFinite(velocity) ? Math.max(lo, Math.min(hi, velocity)) : lo;
  const t = (v - lo) / (hi - lo);
  const ink = ramp.ink ?? component.rhythm['step-cell-ink'];
  if (t <= 0) return { velocity: v, t: 0, fill: ramp.min.toUpperCase(), ink };
  if (t >= 1) return { velocity: v, t: 1, fill: ramp.max.toUpperCase(), ink };
  const a = hexToOklab(ramp.min), b = hexToOklab(ramp.max);
  return { velocity: v, t, fill: oklabToHex(a.map((x, i) => x + (b[i] - x) * t)), ink };
}

/** The runtime velocity-fill custom property for a cell, as surpriseFillStyle does for a slot row. */
export function velocityFillStyle(velocity, ramp = VELOCITY_RAMP) {
  return { [cssVar('velocity-fill')]: velocityFill(velocity, ramp).fill };
}
