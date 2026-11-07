import { filterPaint, readCanvasFont, readLive } from "../alias.js";
import { envelopeXs } from "./envelope.js";

function sizeOf(canvas) {
  const w = Math.max(1, canvas.clientWidth || 0);
  const h = Math.max(1, canvas.clientHeight || 0);
  const ratio = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
  const pw = Math.max(1, Math.floor(w * ratio));
  const ph = Math.max(1, Math.floor(h * ratio));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext("2d");
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w, h };
}

function clamp(n) {
  return Math.max(0, Math.min(1, n));
}

/** Draw a display from the live cascade. Call again after a token change. */
export function paintCanvas(canvas, control) {
  const { ctx, w, h } = sizeOf(canvas);
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const font = readCanvasFont(canvas);
  if (control.paint === "swatch") {
    const accent = readLive(canvas, "accent");
    const step = readLive(canvas, "rhythm.step-cell-on");
    canvas.dataset.ncAccent = accent;
    canvas.dataset.ncStep = step;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = step;
    ctx.fillRect(w / 2, 0, w / 2, h);
    return;
  }
  if (control.paint === "filter" && typeof control.hz === "number") {
    paintFilterResponse(ctx, w, h, control, canvas, font);
    return;
  }
  if (control.paint === "filter") {
    const mode = control.mode ?? "lp";
    const stroke = readLive(canvas, filterPaint(mode));
    const axis = readLive(canvas, "divider");
    const cutoff = clamp(control.cutoff ?? 0.5);
    const width = 0.08 + (1 - clamp(control.resonance ?? 0.2)) * 0.22;
    ctx.strokeStyle = axis;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.lineTo(w, h * 0.72);
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const f = x / Math.max(1, w);
      let g = 0;
      if (mode === "lp") g = f < cutoff ? 1 : Math.max(0, 1 - (f - cutoff) / width);
      else if (mode === "hp") g = f > cutoff ? 1 : Math.max(0, 1 - (cutoff - f) / width);
      else g = Math.max(0, 1 - Math.abs(f - cutoff) / width);
      const y = h * 0.78 - g * h * 0.62;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.fillStyle = readLive(canvas, "text-sub");
    ctx.font = font;
    ctx.fillText(mode.toUpperCase(), 0, h);
    canvas.dataset.ncAccent = stroke;
    return;
  }
  if (control.paint === "envelope") {
    // An attack-decay envelope on the kit's fixed time scale (envelope.js): attack ramps to full, decay falls to
    // silence (an exponential to 1% at its end). 0 s is a vertical line. `max`: the longest [attack, decay] (s).
    ctx.strokeStyle = readLive(canvas, "accent");
    const attack = Math.max(0, control.attack ?? 0);
    const decay = Math.max(0, control.decay ?? 0.4);
    const [x0, xa, xd] = envelopeXs([attack, decay], control.max ?? [1, 4], w);
    const top = 2;
    const base = h - 1;
    ctx.beginPath();
    ctx.moveTo(x0, base);
    ctx.lineTo(xa, top);
    const n = Math.max(1, Math.ceil(xd - xa));
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      ctx.lineTo(xa + (xd - xa) * f, base - (base - top) * Math.exp(-4.6 * f) * (1 - f * 0.01));
    }
    ctx.lineTo(xd, base);
    ctx.lineTo(w, base);
    ctx.stroke();
    canvas.dataset.ncAccent = ctx.strokeStyle;
    return;
  }
  if (control.paint === "waveform") {
    // A sample (NYX's pads): min/max pairs per column across the width, the played region tinted, its start and
    // end and any slice points as marks, and where the voice is now (position 0..1, while it plays).
    const peaks = Array.isArray(control.peaks) ? control.peaks : [];
    const [r0, r1] = Array.isArray(control.region) ? control.region : [0, 1];
    const accent = readLive(canvas, "accent");
    const quiet = readLive(canvas, "text-sub");
    const mid = h / 2;
    ctx.fillStyle = readLive(canvas, "accent-soft");
    ctx.fillRect(clamp(r0) * w, 0, (clamp(r1) - clamp(r0)) * w, h);
    ctx.strokeStyle = readLive(canvas, "divider");
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
    const cols = Math.floor(peaks.length / 2);
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * w;
      const lo = Math.max(-1, Math.min(1, peaks[c * 2] ?? 0));
      const hi = Math.max(-1, Math.min(1, peaks[c * 2 + 1] ?? 0));
      const f = (c + 0.5) / cols;
      ctx.strokeStyle = f >= r0 && f <= r1 ? accent : quiet;
      ctx.beginPath();
      ctx.moveTo(x, mid - hi * (mid - 1));
      ctx.lineTo(x, mid - lo * (mid - 1) + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = accent;
    for (const m of [r0, r1, ...(Array.isArray(control.markers) ? control.markers : [])]) {
      const x = Math.round(clamp(m) * (w - 1)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    if (typeof control.position === "number" && control.position >= 0) {
      ctx.fillStyle = readLive(canvas, "text");
      ctx.fillRect(Math.round(clamp(control.position) * (w - 1)), 0, 1, h);
    }
    if (!cols) {
      ctx.fillStyle = quiet;
      ctx.font = font;
      ctx.fillText(control.empty ?? "Empty", 0, mid + 4);
    }
    canvas.dataset.ncAccent = accent;
    return;
  }
  if (control.paint === "meter") {
    const level = clamp(control.level ?? 0);
    ctx.fillStyle = readLive(canvas, "divider");
    ctx.fillRect(0, h * 0.4, w, h * 0.2);
    ctx.fillStyle = readLive(canvas, "accent");
    ctx.fillRect(0, h * 0.4, w * level, h * 0.2);
    canvas.dataset.ncAccent = ctx.fillStyle;
    return;
  }
  const steps = Math.max(1, control.steps ?? 16);
  const step = (((control.step ?? 0) % steps) + steps) % steps;
  ctx.fillStyle = readLive(canvas, "rhythm.step-cell-off");
  ctx.fillRect(0, h * 0.45, w, h * 0.1);
  ctx.fillStyle = readLive(canvas, "rhythm.playhead");
  ctx.fillRect((step / steps) * w, h * 0.3, Math.max(1, w / steps), h * 0.4);
  canvas.dataset.ncAccent = readLive(canvas, "accent");
}

/** The response box: 20 Hz .. 20 kHz on a log axis, +24 .. −60 dB (ASTRID's FilterCurve frame). */
export const FILTER_MIN_HZ = 20;
export const FILTER_MAX_HZ = 20000;
export const FILTER_TOP_DB = 24;
export const FILTER_FLOOR_DB = -60;

/** |H| of the RBJ biquad nc-fx runs (low-pass, high-pass, band-pass with 0 dB peak) at `f` Hz. */
export function biquadMagnitude(mode, hz, q, f, sampleRate = 48000) {
  const w0 = (2 * Math.PI * Math.min(hz, sampleRate * 0.49)) / sampleRate;
  const c = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  let b0, b1, b2;
  if (mode === "hp") [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  else if (mode === "bp") [b0, b1, b2] = [alpha, 0, -alpha];
  else [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
  const a0 = 1 + alpha, a1 = -2 * c, a2 = 1 - alpha;
  const w = (2 * Math.PI * f) / sampleRate;
  const re = (k0, k1, k2) => k0 + k1 * Math.cos(w) + k2 * Math.cos(2 * w);
  const im = (k1, k2) => -(k1 * Math.sin(w) + k2 * Math.sin(2 * w));
  const num = Math.hypot(re(b0, b1, b2), im(b1, b2));
  const den = Math.hypot(re(a0, a1, a2), im(a1, a2));
  return den > 0 ? num / den : 0;
}

/** x (0..w) for a frequency on the log axis, and y (0..h) for a level in dB, in the response box. */
export function filterX(hz, w) {
  const t = Math.log(Math.max(FILTER_MIN_HZ, Math.min(FILTER_MAX_HZ, hz)) / FILTER_MIN_HZ) / Math.log(FILTER_MAX_HZ / FILTER_MIN_HZ);
  return t * w;
}
export function filterY(db, top, bottom) {
  const d = Math.max(FILTER_FLOOR_DB, Math.min(FILTER_TOP_DB, db));
  return top + ((FILTER_TOP_DB - d) / (FILTER_TOP_DB - FILTER_FLOOR_DB)) * (bottom - top);
}

/**
 * The filter's real response (control.hz, control.q, control.sampleRate; mode lp | hp | bp), the 0 dB line, a dashed
 * mark at the cutoff and the axis ends. `open: true` (a low-pass all the way up) draws the flat line.
 */
function paintFilterResponse(ctx, w, h, control, canvas, font) {
  const mode = control.mode ?? "lp";
  const stroke = readLive(canvas, filterPaint(mode));
  const axis = readLive(canvas, "divider");
  const sub = readLive(canvas, "text-sub");
  const size = Number.parseFloat(String(font).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "10");
  const top = 1;
  const bottom = Math.max(top + 4, h - size - 3);
  const q = control.q ?? Math.SQRT1_2;
  const zero = Math.round(filterY(0, top, bottom)) + 0.5;
  ctx.strokeStyle = axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, zero);
  ctx.lineTo(w, zero);
  ctx.stroke();
  ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const f = FILTER_MIN_HZ * (FILTER_MAX_HZ / FILTER_MIN_HZ) ** (x / Math.max(1, w));
    const mag = control.open ? 1 : biquadMagnitude(mode, control.hz, q, f, control.sampleRate);
    const y = filterY(20 * Math.log10(Math.max(1e-5, mag)), top, bottom);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = stroke;
  ctx.stroke();
  if (!control.open) {
    const mx = Math.round(filterX(control.hz, w)) + 0.5;
    ctx.strokeStyle = sub;
    ctx.setLineDash?.([2, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, top);
    ctx.lineTo(mx, bottom);
    ctx.stroke();
    ctx.setLineDash?.([]);
  }
  ctx.fillStyle = sub;
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.fillText("20 Hz", 0, h - 1);
  ctx.textAlign = "right";
  ctx.fillText("20 kHz", w, h - 1);
  ctx.textAlign = "left";
  canvas.dataset.ncAccent = stroke;
  canvas.dataset.ncFilterHz = String(Math.round(control.hz));
}
