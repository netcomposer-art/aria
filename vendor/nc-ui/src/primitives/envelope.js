// nc-ui envelope geometry: where an envelope drawing puts its segments (Peter, 2026-11-01: "Attack is at 0 ms, but
// the graphic shows a real slope for the attack, which is wrong. The whole graphic needs to be recalibrated").
//
// One fixed time scale for every time segment of every envelope drawing: a segment's width is K * ln(1 + t / TAU),
// with K set so the longest times the app allows just fill the box. So 0 ms is no width at all (a vertical line),
// 10 ms is visibly short, 2 s is long, and the same time is the same width in every segment. A hold (the Sustain,
// which is a level, not a time) takes the width that is left, never less than `hold`. Heights are the caller's: the
// drawing's value is its true share of the box.
// Self-contained (no imports). nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.

/** The scale's knee (seconds): below about this, width grows with time; above, with its logarithm. */
export const ENV_TAU = 0.03;

/** A time (s) in the scale's units. */
export function envUnits(seconds) {
  const s = Number(seconds);
  return s > 0 && Number.isFinite(s) ? Math.log1p(s / ENV_TAU) : 0;
}

/**
 * Segment boundaries for a drawing `width` wide.
 * segments: the times in order (seconds), with `null` for the hold.
 * max: the longest each time segment can be (seconds; the hold's entry is ignored), which fixes the scale.
 * hold: the hold's smallest width (default width / 6).
 * Returns the x of every boundary: [0, end of segment 1, ..., end of the last]. Without a hold the drawing ends
 * where the last segment ends (the rest of the box is after the envelope); with one it ends at `width`.
 */
export function envelopeXs(segments, max, width, hold = width / 6) {
  const hasHold = segments.some((s) => s === null);
  const room = Math.max(0, width - (hasHold ? hold : 0));
  const full = segments.reduce((sum, s, i) => (s === null ? sum : sum + envUnits(max[i])), 0);
  const k = full > 0 ? room / full : 0;
  const widths = segments.map((s) => (s === null ? 0 : Math.min(room, envUnits(s) * k)));
  if (hasHold) {
    const used = widths.reduce((a, b) => a + b, 0);
    const at = segments.indexOf(null);
    widths[at] = Math.max(hold, width - used);
  }
  const xs = [0];
  for (const w of widths) xs.push(Math.round((xs[xs.length - 1] + w) * 100) / 100);
  if (hasHold) xs[xs.length - 1] = width;
  return xs;
}

/**
 * Where to put one label per segment: under its middle, pushed apart to at least `gap` so a zero-width segment's
 * letter never sits on its neighbour's, and kept inside 0..width (labels drawn centred).
 */
export function envelopeLabelXs(xs, gap, width) {
  const n = xs.length - 1;
  const at = [];
  for (let i = 0; i < n; i++) at.push((xs[i] + xs[i + 1]) / 2);
  const half = gap / 2;
  for (let i = 0; i < n; i++) at[i] = Math.max(at[i], i === 0 ? half : at[i - 1] + gap);
  for (let i = n - 1; i >= 0; i--) at[i] = Math.min(at[i], i === n - 1 ? width - half : at[i + 1] - gap);
  for (let i = 0; i < n; i++) at[i] = Math.max(at[i], i === 0 ? half : at[i - 1] + gap);
  return at.map((x) => Math.round(x * 100) / 100);
}
