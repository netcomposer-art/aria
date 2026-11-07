// A console level meter: vertical, one or two channels (stereo, two-sided), each a peak fill over an RMS fill in
// the lighter Prussian blue, a thin peak-hold line, and a clip light at the top that stays lit until clicked.
// Styles are in kit.js (.nc-meter); every length and colour is a token.
//
// Levels are 0..1 positions on the host's scale (the same law as the fader beside it, so the tick labels line up
// with both). The host calls update() every animation frame with what the audio did; the meter keeps its own
// ballistics: it rises at once (motion-meter-rise), falls back over motion-meter-fall, and the hold line stays for
// motion-meter-hold before it falls. Meters follow the audio, so nothing here is a CSS transition.

import { prop } from "../alias.js";

const handles = new WeakMap();
/** Fallbacks for the motion tokens when the cascade has none yet (seconds). */
const FALL_FALLBACK = 0.2;
const HOLD_FALLBACK = 1.5;
/** After the hold, the hold line falls this many positions per second. */
const HOLD_FALL_RATE = 0.5;

/** A CSS time ("0.2s", ".2s", "200ms") in seconds, or the fallback. */
export function cssSeconds(text, fallback) {
  const raw = String(text ?? "").trim();
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n / 1000 : n;
}

function readSeconds(el, name, fallback) {
  const view = el.ownerDocument?.defaultView ?? globalThis;
  if (typeof view.getComputedStyle !== "function") return fallback;
  return cssSeconds(view.getComputedStyle(el).getPropertyValue(prop(name)), fallback);
}

/**
 * @param {{ channels?: 1 | 2, label: string, onClear?: () => void, doc?: Document }} options
 */
export function createMeter(options) {
  const doc = options.doc ?? globalThis.document;
  const count = options.channels === 2 ? 2 : 1;
  const el = doc.createElement("div");
  el.className = "nc-meter";
  el.dataset.ncChannels = String(count);
  const clip = doc.createElement("button");
  clip.type = "button";
  clip.className = "nc-meter-clip";
  clip.dataset.lit = "false";
  const bars = doc.createElement("div");
  bars.className = "nc-meter-bars";
  bars.setAttribute("aria-hidden", "true");
  const channels = [];
  for (let i = 0; i < count; i++) {
    const bar = doc.createElement("span");
    bar.className = "nc-meter-bar";
    const peak = doc.createElement("span");
    peak.className = "nc-meter-peak";
    const rms = doc.createElement("span");
    rms.className = "nc-meter-rms";
    const hold = doc.createElement("span");
    hold.className = "nc-meter-hold";
    bar.append(peak, rms, hold);
    bars.append(bar);
    channels.push({ peak, rms, hold, shown: { peak: -1, rms: -1, hold: -1 }, level: { peak: 0, rms: 0 }, holdAt: 0, holdAge: 0 });
  }
  el.append(clip, bars);

  let label = options.label;
  let onClear = options.onClear;
  let lit = false;
  let fall = -1;
  let holdFor = -1;

  const paintClip = () => {
    clip.dataset.lit = lit ? "true" : "false";
    clip.setAttribute("aria-pressed", lit ? "true" : "false");
    clip.setAttribute("aria-label", lit ? `${label} clipped: clear` : `${label} clip light`);
    clip.title = lit ? "Clipped. Click to clear" : "Clip light";
  };
  const write = (node, key, shown, value) => {
    const v = Math.round(value * 1000) / 1000;
    if (shown[key] === v) return;
    shown[key] = v;
    node.style.transform = key === "hold" ? `translateY(${Math.round((1 - v) * 1000) / 10}%)` : `scaleY(${v})`;
  };

  clip.addEventListener("click", () => {
    handle.clear();
    onClear?.();
  });

  const handle = {
    el,
    get clipped() {
      return lit;
    },
    /**
     * One frame: per channel, the block's peak and RMS as 0..1 positions, and whether it went over (clipped).
     * `dt` is the seconds since the last frame.
     */
    update(levels, dt) {
      if (fall < 0) fall = readSeconds(el, "motion-meter-fall", FALL_FALLBACK);
      if (holdFor < 0) holdFor = readSeconds(el, "motion-meter-hold", HOLD_FALLBACK);
      const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
      const decay = fall > 0 ? Math.exp(-step / fall) : 0;
      channels.forEach((ch, i) => {
        const input = levels[i] ?? levels[0] ?? { peak: 0, rms: 0 };
        const peak = Math.min(1, Math.max(0, Number(input.peak) || 0));
        const rms = Math.min(peak, Math.max(0, Number(input.rms) || 0));
        if (input.over) handle.clip();
        // Rise at once, fall back exponentially.
        ch.level.peak = peak >= ch.level.peak ? peak : peak + (ch.level.peak - peak) * decay;
        ch.level.rms = rms >= ch.level.rms ? rms : rms + (ch.level.rms - rms) * decay;
        ch.holdAge += step;
        if (peak >= ch.holdAt) {
          ch.holdAt = peak;
          ch.holdAge = 0;
        } else if (ch.holdAge > holdFor) ch.holdAt = Math.max(peak, ch.holdAt - HOLD_FALL_RATE * step);
        write(ch.peak, "peak", ch.shown, ch.level.peak);
        write(ch.rms, "rms", ch.shown, ch.level.rms);
        write(ch.hold, "hold", ch.shown, ch.holdAt);
        ch.hold.dataset.off = ch.holdAt <= 0.001 ? "true" : "false";
      });
    },
    /** Light the clip light (it stays lit until clear() or a click). */
    clip() {
      if (lit) return;
      lit = true;
      paintClip();
    },
    clear() {
      lit = false;
      paintClip();
    },
    /** Drop everything to the floor (the source went away). */
    reset() {
      for (const ch of channels) {
        ch.level.peak = 0;
        ch.level.rms = 0;
        ch.holdAt = 0;
        ch.holdAge = 0;
        write(ch.peak, "peak", ch.shown, 0);
        write(ch.rms, "rms", ch.shown, 0);
        write(ch.hold, "hold", ch.shown, 0);
        ch.hold.dataset.off = "true";
      }
    },
    setLabel(text) {
      label = text;
      paintClip();
    },
    configure(next) {
      if (next.onClear) onClear = next.onClear;
    },
  };
  paintClip();
  handle.reset();
  handles.set(el, handle);
  return handle;
}

/** The handle of a meter made by createMeter (or by a strip control), from its element. */
export function meterHandle(el) {
  return el ? handles.get(el) : undefined;
}
