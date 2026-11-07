// nc-ui EQ graph (Peter, 2026-11-01: "a real-time visualizer at the top of the [EQ] module that shows the frequency
// cuts and boosts ... make it beautiful like FabFilter"). A frequency plot, 20 Hz to 20 kHz on a log axis and the
// EQ's own gain range: the combined response as one smooth line with a soft fill to 0 dB, each band's own curve faintly
// behind it, a node per band to drag (frequency across, gain up and down, the wheel for Q), and a live spectrum of
// what the effect puts out underneath, all in the kit's tokens, light and dark.
//
// The kit draws; the host owns the maths and the state. The control brings `response(freqs)` (nc-fx's eqGraph() gives
// the engine's exact curve) and `onBand(id, { hz?, db?, q? })` / `onReset(id)`, which go through the same setters as
// the EQ's sliders, so the sliders and the graph never disagree. `spectrum: { open(): AnalyserNode | null, close() }`
// is optional; it is opened only while the graph is on screen, and read about 30 times a second while sound flows.
// nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.
//
// Self-contained (no imports), so an app that vendors only this file (ASTRID's React Hacks panel) draws the same graph;
// it reads the --nc-ui-* custom properties from the live cascade.

/** A colour token's computed value on `el` (follows the theme and the card's shade). */
function readLive(el, name) {
  const doc = el.ownerDocument;
  const probe = doc.createElement("span");
  probe.style.position = "absolute";
  probe.style.color = `var(--nc-ui-${name})`;
  el.append(probe);
  const value = doc.defaultView.getComputedStyle(probe).color;
  probe.remove();
  return value;
}
/** The label font (the kit's label-size, label-weight and UI font) for canvas text. */
function readCanvasFont(el) {
  const doc = el.ownerDocument;
  const probe = doc.createElement("span");
  probe.style.fontFamily = "var(--nc-ui-font-ui)";
  probe.style.fontSize = "var(--nc-ui-label-size)";
  probe.style.fontWeight = "var(--nc-ui-label-weight)";
  el.append(probe);
  const font = doc.defaultView.getComputedStyle(probe).font;
  probe.remove();
  return font;
}

/** The plotted frequency span (Hz). */
export const EQ_MIN_HZ = 20;
export const EQ_MAX_HZ = 20000;
const SPAN = Math.log(EQ_MAX_HZ / EQ_MIN_HZ);
/** Spectrum frames: about 30 a second while sound flows; a slow look 4 times a second while it is silent. */
const FRAME_MS = 32;
const IDLE_MS = 250;
/** Below this (dBFS, per bin) is silence; after this long of it the loop idles. */
const FLOOR_DB = -100;
const SILENT_MS = 1200;
/** Spectrum scale: tilted 4.5 dB per octave about 1 kHz (so a mix reads level), then this window (dB). */
const TILT_DB_OCT = 4.5;
const SPEC_TOP_DB = -6;
const SPEC_BOTTOM_DB = -96;
/** How fast a peak falls (dB per second). */
const DECAY_DB_S = 48;
/** The grid: every decade's 1-9 multiples; these carry labels. */
const LABEL_HZ = [100, 1000, 10000];
const GRID_DB = [6, 12];

/** x (0..w) for a frequency, and back. */
export function eqX(hz, w) {
  return (Math.log(Math.max(EQ_MIN_HZ, Math.min(EQ_MAX_HZ, hz)) / EQ_MIN_HZ) / SPAN) * w;
}
export function eqHz(x, w) {
  return EQ_MIN_HZ * Math.exp((Math.max(0, Math.min(w, x)) / Math.max(1, w)) * SPAN);
}
/** y for a gain in a plot of height h with `pad` above +range and below -range, and back. */
export function eqY(db, h, range, pad) {
  const half = h / 2 - pad;
  return h / 2 - (Math.max(-range, Math.min(range, db)) / range) * half;
}
export function eqDb(y, h, range, pad) {
  const half = Math.max(1, h / 2 - pad);
  return Math.max(-range, Math.min(range, ((h / 2 - y) / half) * range));
}

/** "938 Hz", "1.5 kHz", "12 kHz". */
export function hzText(hz) {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} kHz`;
  return `${Math.round(hz)} Hz`;
}
const dbText = (db) => `${db > 0 ? "+" : db < 0 ? "−" : ""}${Math.abs(Math.round(db * 10) / 10)} dB`;

/** What a key does to a band: a patch (engine units), "reset", or null for keys the node doesn't take. */
export function eqKeyPatch(band, key, shift, range) {
  const big = shift ? 3 : 1;
  const db = (d) => ({ db: Math.max(-range, Math.min(range, band.db + d * big)) });
  const hz = (d) => ({
    hz: Math.max(band.minHz ?? EQ_MIN_HZ, Math.min(band.maxHz ?? EQ_MAX_HZ, band.hz * 2 ** ((d * big) / 6))),
  });
  const q = (d) => ({ q: Math.max(band.minQ ?? 0.1, Math.min(band.maxQ ?? 20, band.q * 1.25 ** (d * big))) });
  switch (key) {
    case "ArrowUp":
      return db(1);
    case "ArrowDown":
      return db(-1);
    case "ArrowRight":
      return band.moveHz ? hz(1) : db(1);
    case "ArrowLeft":
      return band.moveHz ? hz(-1) : db(-1);
    case "PageUp":
      return band.moveQ ? q(1) : null;
    case "PageDown":
      return band.moveQ ? q(-1) : null;
    case "Delete":
    case "Backspace":
    case "Home":
      return "reset";
    default:
      return null;
  }
}

/**
 * Where a band's node sits, as a fraction of its gain: on its own curve at its frequency. A bell peaks there (1); an
 * RBJ shelf (S = 1) is at exactly half its gain at its corner (0.5), so the dot rides the curve, not above it.
 */
export function nodeScale(band) {
  return band.kind === "lowshelf" || band.kind === "highshelf" ? 0.5 : 1;
}

/** A relative drag: the band's start plus the pointer's movement (Shift for fine), as a patch. The node follows the
 * pointer, so a shelf's gain moves twice the dot's height. */
export function eqDragPatch(band, start, dx, dy, w, h, range, pad, fine) {
  const k = fine ? 0.25 : 1;
  const out = {};
  const half = Math.max(1, h / 2 - pad);
  out.db = Math.max(-range, Math.min(range, start.db - ((dy * k) / half) * range / nodeScale(band)));
  if (band.moveHz) {
    const hz = start.hz * Math.exp(((dx * k) / Math.max(1, w)) * SPAN);
    out.hz = Math.max(band.minHz ?? EQ_MIN_HZ, Math.min(band.maxHz ?? EQ_MAX_HZ, hz));
  }
  return out;
}

/**
 * Where a maximized card opens over the modules (the FX card's "over" mode, and ASTRID's Hacks): three module widths
 * (plus the two gaps), starting at its own column and kept inside the row and the viewport, a hairline in from each
 * edge. Rects are viewport px; returns px relative to the module (the card is absolutely positioned in it).
 */
export function overPanelBox(at, module, row, gap, viewW) {
  const left0 = Math.max(0, row.left) + 1;
  const right0 = Math.min(row.right, viewW) - 1;
  const width = Math.min(module.width * 3 + gap * 2, right0 - left0);
  const left = Math.max(left0, Math.min(at.left, right0 - width));
  return { left: Math.round(left - module.left), top: Math.round(at.top - module.top), width: Math.round(width) };
}

const state = new WeakMap();

/** Render the graph: a plot box with the spectrum canvas, the curve canvas and one focusable node per band. */
export function renderEqGraph(control, lookup) {
  const wrap = document.createElement("div");
  wrap.className = "nc-eq";
  wrap.dataset.ncId = control.id;
  wrap.dataset.ncEq = "";
  wrap.setAttribute("role", "group");
  const plot = document.createElement("div");
  plot.className = "nc-eq-plot";
  const spec = document.createElement("canvas");
  spec.className = "nc-eq-spectrum";
  spec.setAttribute("aria-hidden", "true");
  const curve = document.createElement("canvas");
  curve.className = "nc-eq-curve";
  curve.setAttribute("aria-hidden", "true");
  const tip = document.createElement("span");
  tip.className = "nc-eq-tip";
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  plot.append(spec, curve);
  for (const band of control.bands) plot.append(renderNode(wrap, band, lookup));
  plot.append(tip);
  plot.addEventListener("click", (event) => {
    if (!eqLocked(wrap) || event.button > 0) return;
    const max = maxHost(wrap)?.querySelector("[data-nc-max-toggle]");
    if (max instanceof HTMLElement) max.click();
  });
  wrap.append(plot);
  const probeEl = document.createElement("i");
  probeEl.className = "nc-token-probe";
  probeEl.dataset.ncProbe = "";
  wrap.append(probeEl);
  state.set(wrap, { control, cache: null, spec: null, active: null });
  patchEqGraph(wrap, control);
  return wrap;
}

function nodeOf(wrap, id) {
  return [...wrap.querySelectorAll(".nc-eq-node")].find((n) => n.dataset.band === id) ?? null;
}

function renderNode(wrap, band, lookup) {
  const node = document.createElement("div");
  node.className = "nc-eq-node";
  node.tabIndex = 0;
  node.dataset.band = band.id;
  node.setAttribute("role", "slider");
  node.setAttribute("aria-orientation", "vertical");
  const live = () => {
    const c = lookup(wrap);
    return c?.type === "eqGraph" ? c : null;
  };
  const bandNow = () => live()?.bands.find((b) => b.id === band.id) ?? null;
  let drag = null;
  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const b = bandNow();
    if (!b) return;
    event.preventDefault();
    node.focus({ preventScroll: true });
    node.setPointerCapture?.(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: { hz: b.hz, db: b.db } };
    node.dataset.drag = "true";
    showTip(wrap, band.id);
  });
  node.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const c = live();
    const b = bandNow();
    const st = state.get(wrap);
    if (!c || !b || !st?.box) return;
    const { w, h, pad } = st.box;
    c.onBand(b.id, eqDragPatch(b, drag.start, event.clientX - drag.x, event.clientY - drag.y, w, h, c.range ?? 18, pad, event.shiftKey));
  });
  const end = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    delete node.dataset.drag;
    if (wrap.ownerDocument.activeElement !== node && !node.matches(":hover")) showTip(wrap, null);
  };
  node.addEventListener("pointerup", end);
  node.addEventListener("pointercancel", end);
  node.addEventListener("dblclick", (event) => {
    event.preventDefault();
    live()?.onReset?.(band.id);
  });
  node.addEventListener("keydown", (event) => {
    const c = live();
    const b = bandNow();
    if (!c || !b) return;
    const patch = eqKeyPatch(b, event.key, event.shiftKey, c.range ?? 18);
    if (!patch) return;
    event.preventDefault();
    if (patch === "reset") c.onReset?.(b.id);
    else c.onBand(b.id, patch);
    showTip(wrap, b.id);
  });
  // The wheel (or a two-finger scroll) over a node with a Q: narrower up, wider down. Accumulated, so a trackpad's
  // small deltas still reach the next step.
  let wheel = null;
  node.addEventListener(
    "wheel",
    (event) => {
      const c = live();
      const b = bandNow();
      if (!c || !b?.moveQ) return;
      event.preventDefault();
      const now = event.timeStamp;
      if (!wheel || now - wheel.t > 400) wheel = { q: b.q, t: now };
      const lines = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
      wheel.q = Math.max(b.minQ ?? 0.1, Math.min(b.maxQ ?? 20, wheel.q * 2 ** (-lines / 240)));
      wheel.t = now;
      c.onBand(b.id, { q: wheel.q });
      showTip(wrap, b.id);
    },
    { passive: false },
  );
  node.addEventListener("pointerenter", () => showTip(wrap, band.id));
  node.addEventListener("focus", () => showTip(wrap, band.id));
  node.addEventListener("pointerleave", () => {
    if (!drag && wrap.ownerDocument.activeElement !== node) showTip(wrap, null);
  });
  node.addEventListener("blur", () => {
    if (!drag) showTip(wrap, null);
  });
  return node;
}

/** The readout beside the band in use: "Mid −18 dB · 938 Hz · Q 0.3". */
function showTip(wrap, id) {
  const st = state.get(wrap);
  if (!st) return;
  const changed = st.active !== id;
  st.active = id;
  if (changed) paintEqGraph(wrap);
  else placeTip(wrap);
}

function placeTip(wrap) {
  const st = state.get(wrap);
  const tip = wrap.querySelector(".nc-eq-tip");
  if (!st || !(tip instanceof HTMLElement)) return;
  const band = st.active ? st.control.bands.find((b) => b.id === st.active) : null;
  for (const n of wrap.querySelectorAll(".nc-eq-node")) {
    if (n instanceof HTMLElement) {
      if (band && n.dataset.band === band.id) n.dataset.active = "true";
      else delete n.dataset.active;
    }
  }
  if (!band || !st.box) {
    tip.hidden = true;
    return;
  }
  const parts = [band.label, dbText(band.db)];
  if (band.kind === "peak") parts.push(hzText(band.hz), `Q ${band.q.toFixed(1)}`);
  else parts.push(`${band.kind === "lowshelf" ? "below" : "above"} ${hzText(band.hz)}`);
  tip.textContent = parts.join(" · ");
  tip.dataset.tone = String(toneOf(st.control, band));
  tip.hidden = false;
  const { w, h, pad } = st.box;
  const x = eqX(band.hz, w);
  const y = eqY(band.db * nodeScale(band), h, st.control.range ?? 18, pad);
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const left = Math.max(0, Math.min(w - tw, x - tw / 2));
  // Above the node, or below it when the node is in the top third.
  const top = y - th - pad * 1.5 >= 0 ? y - th - pad * 1.5 : Math.min(h - th, y + pad * 1.5);
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function toneOf(control, band) {
  const i = control.bands.indexOf(band);
  return (i % 3) + 1;
}

/** Patch to a new control: names and values on the nodes, the curve (re-computed only when a value moved), the loop. */
export function patchEqGraph(wrap, control) {
  const st = state.get(wrap);
  if (!st) return;
  st.control = control;
  wrap.setAttribute("aria-label", control.label ?? "EQ curve");
  if (control.help) wrap.setAttribute("data-nc-help", control.help);
  else wrap.removeAttribute("data-nc-help");
  wrap.dataset.on = control.on === false ? "false" : "true";
  syncLock(wrap);
  const range = control.range ?? 18;
  control.bands.forEach((band, i) => {
    const node = nodeOf(wrap, band.id);
    if (!(node instanceof HTMLElement)) return;
    node.dataset.tone = String((i % 3) + 1);
    node.dataset.kind = band.kind;
    node.setAttribute("aria-label", `${band.label} band`);
    node.setAttribute("aria-valuemin", String(-range));
    node.setAttribute("aria-valuemax", String(range));
    node.setAttribute("aria-valuenow", String(band.db));
    node.setAttribute("aria-valuetext", band.valueText ?? `${dbText(band.db)}, ${hzText(band.hz)}`);
    node.setAttribute(
      "aria-keyshortcuts",
      band.moveQ ? "ArrowUp ArrowDown ArrowLeft ArrowRight PageUp PageDown Delete" : "ArrowUp ArrowDown Delete",
    );
    if (band.help) node.setAttribute("data-nc-help", band.help);
    else node.removeAttribute("data-nc-help");
  });
  paintEqGraph(wrap);
  syncLoop(wrap);
}

/** Size a canvas to its box at the device's pixel ratio; returns its context and CSS size. */
function fit(canvas) {
  const w = Math.max(1, canvas.clientWidth || 0);
  const h = Math.max(1, canvas.clientHeight || 0);
  const ratio = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
  const pw = Math.max(1, Math.round(w * ratio));
  const ph = Math.max(1, Math.round(h * ratio));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext("2d");
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w, h };
}

/** The colours, read from the live cascade (so a theme change or a card's shade is picked up on the next paint). */
function colours(wrap) {
  return {
    curve: readLive(wrap, "eq-curve"),
    fill: readLive(wrap, "eq-fill"),
    quiet: readLive(wrap, "text-sub"),
    grid: readLive(wrap, "eq-grid"),
    zero: readLive(wrap, "divider"),
    label: readLive(wrap, "text-sub"),
    spectrum: readLive(wrap, "eq-spectrum"),
    bands: [readLive(wrap, "eq-band-1"), readLive(wrap, "eq-band-2"), readLive(wrap, "eq-band-3")],
  };
}

/** The values the curve depends on, as one string: re-compute the response only when it changes. */
function curveKey(control, w) {
  return `${w}|${control.sampleRate ?? ""}|${control.bands.map((b) => `${b.id}:${b.hz}:${b.db}:${b.q}`).join(",")}`;
}

/** Repaint the curve layer and place the nodes (after a value, size or theme change). */
export function paintEqGraph(wrap) {
  if (state.has(wrap)) syncLock(wrap);
  const st = state.get(wrap);
  const canvas = wrap.querySelector(".nc-eq-curve");
  // Not in the page yet (a fresh render): the module's redraw paints it once it is placed.
  if (!st || !(canvas instanceof HTMLCanvasElement) || !wrap.isConnected) return;
  const control = st.control;
  const { ctx, w, h } = fit(canvas);
  if (!ctx) return;
  const pad = Math.max(8, Math.round(h * 0.06));
  const range = control.range ?? 18;
  st.box = { w, h, pad };
  st.colours = colours(wrap);
  const c = st.colours;
  // The response, one point per px (log-spaced), cached until a value or the width changes.
  const key = curveKey(control, w);
  if (!st.cache || st.cache.key !== key) {
    const n = Math.max(64, Math.ceil(w) + 1);
    const freqs = new Float64Array(n);
    for (let i = 0; i < n; i++) freqs[i] = eqHz((i / (n - 1)) * w, w);
    let resp = null;
    try {
      resp = typeof control.response === "function" ? control.response(freqs) : null;
    } catch {
      resp = null;
    }
    st.cache = { key, freqs, total: resp?.total ?? new Float64Array(n), bands: resp?.bands ?? [] };
  }
  ctx.clearRect(0, 0, w, h);
  const font = readCanvasFont(wrap);
  const on = control.on !== false;
  drawGrid(ctx, w, h, range, pad, c, font);
  const { freqs, total, bands } = st.cache;
  const xs = Array.from(freqs, (f) => eqX(f, w));
  const zeroY = eqY(0, h, range, pad);
  // Each band's own curve: a thin line in its colour behind the sum; the band in use (hovered, focused, dragged) also
  // gets a faint fill of its own.
  bands.forEach((arr, i) => {
    if (!arr || !arr.some((v) => Math.abs(v) > 0.05)) return;
    const col = on ? c.bands[i % 3] : c.quiet;
    const ys = Array.from(arr, (v) => eqY(v, h, range, pad));
    ctx.save();
    if (st.active && control.bands[i]?.id === st.active) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = col;
      fillToZero(ctx, xs, ys, zeroY);
    }
    ctx.globalAlpha = on ? 0.75 : 0.4;
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.75;
    strokeLine(ctx, xs, ys);
    ctx.restore();
  });
  // The sum: a soft fill to 0 dB, then the line over a wide, faint copy of itself (a restrained glow).
  const ys = Array.from(total, (v) => eqY(v, h, range, pad));
  const col = on ? c.curve : c.quiet;
  ctx.save();
  ctx.fillStyle = on ? c.fill : c.quiet;
  ctx.globalAlpha = on ? 0.2 : 0.08;
  fillToZero(ctx, xs, ys, zeroY);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = on ? c.fill : col;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (on) {
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 4;
    strokeLine(ctx, xs, ys);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.25;
  strokeLine(ctx, xs, ys);
  ctx.restore();
  placeNodes(wrap);
  placeTip(wrap);
}

function drawGrid(ctx, w, h, range, pad, c, font) {
  ctx.save();
  ctx.lineWidth = 1;
  // Decades: a hairline at each 1-9 multiple, stronger at the labelled ones.
  for (let decade = 10; decade <= 10000; decade *= 10) {
    for (let m = 1; m <= 9; m++) {
      const hz = decade * m;
      if (hz < EQ_MIN_HZ || hz > EQ_MAX_HZ) continue;
      const x = Math.round(eqX(hz, w)) + 0.5;
      ctx.globalAlpha = LABEL_HZ.includes(hz) ? 0.9 : 0.35;
      ctx.strokeStyle = c.grid;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }
  for (const db of GRID_DB) {
    if (db > range) continue;
    for (const s of [1, -1]) {
      const y = Math.round(eqY(db * s, h, range, pad)) + 0.5;
      ctx.globalAlpha = db === 12 ? 0.75 : 0.4;
      ctx.strokeStyle = c.grid;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.zero;
  const y0 = Math.round(eqY(0, h, range, pad)) + 0.5;
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.lineTo(w, y0);
  ctx.stroke();
  // Sparse labels: 100, 1k, 10k along the bottom; +12, 0, -12 at the left.
  ctx.font = font;
  ctx.fillStyle = c.label;
  ctx.globalAlpha = 0.9;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  for (const hz of LABEL_HZ) {
    const text = hz >= 1000 ? `${hz / 1000}k` : String(hz);
    const tw = ctx.measureText(text).width;
    const x = eqX(hz, w) + 3;
    // Beside its line, or (near the right edge) just before it.
    ctx.fillText(text, x + tw + 2 > w ? eqX(hz, w) - tw - 3 : x, h - 2);
  }
  // At the right edge, just above their lines (the low shelf's node lives at the left).
  ctx.textBaseline = "bottom";
  ctx.textAlign = "right";
  for (const db of [12, 0, -12]) {
    if (Math.abs(db) > range) continue;
    const y = eqY(db, h, range, pad);
    ctx.fillText(db > 0 ? `+${db}` : db < 0 ? `−${-db}` : "0", w - 3, Math.round(y) - 1);
  }
  ctx.restore();
}

/** A smooth path through the points (quadratic curves through the midpoints). */
function tracePath(ctx, xs, ys) {
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i < xs.length - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) / 2;
    const my = (ys[i] + ys[i + 1]) / 2;
    ctx.quadraticCurveTo(xs[i], ys[i], mx, my);
  }
  ctx.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
}
function strokeLine(ctx, xs, ys) {
  ctx.beginPath();
  tracePath(ctx, xs, ys);
  ctx.stroke();
}
function fillToZero(ctx, xs, ys, zeroY) {
  ctx.beginPath();
  tracePath(ctx, xs, ys);
  ctx.lineTo(xs[xs.length - 1], zeroY);
  ctx.lineTo(xs[0], zeroY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Inside a host that can be maximized, the graph is a display until the host is maximized (Peter, 2026-11-01: "when
 * not maxed don't offer the ability to adjust the freq nodes directly"): the dots are markers, not sliders, and a click
 * on the plot maximizes. The contract, so apps outside the kit can join: the host carries data-nc-maxable, gets
 * data-nc-max while maximized, and its maximize button carries data-nc-max-toggle. With no such host (a graph on its
 * own), the nodes stay editable.
 */
function maxHost(wrap) {
  return wrap.closest("[data-nc-maxable]");
}
function eqLocked(wrap) {
  const host = maxHost(wrap);
  return !!host && !host.hasAttribute("data-nc-max");
}

function syncLock(wrap) {
  const locked = eqLocked(wrap);
  if (locked) wrap.dataset.locked = "";
  else delete wrap.dataset.locked;
  for (const n of wrap.querySelectorAll(".nc-eq-node")) {
    if (!(n instanceof HTMLElement)) continue;
    n.setAttribute("tabindex", locked ? "-1" : "0");
    if (locked) n.setAttribute("aria-hidden", "true");
    else n.removeAttribute("aria-hidden");
  }
  if (locked) {
    const st = state.get(wrap);
    if (st?.active) {
      st.active = null;
      placeTip(wrap);
    }
  }
  return locked;
}

function placeNodes(wrap) {
  syncLock(wrap);
  const st = state.get(wrap);
  if (!st?.box) return;
  const { w, h, pad } = st.box;
  const range = st.control.range ?? 18;
  for (const band of st.control.bands) {
    const node = nodeOf(wrap, band.id);
    if (!(node instanceof HTMLElement)) continue;
    node.style.left = `${eqX(band.hz, w).toFixed(1)}px`;
    node.style.top = `${eqY(band.db * nodeScale(band), h, range, pad).toFixed(1)}px`;
  }
}

// The spectrum: an AnalyserNode read about 30 times a second, log-binned to one column per 2 px, tilted, smoothed
// and held with a decay, drawn as a soft filled shape under the curve. It runs only while the graph is connected,
// on screen and the page visible; after a while of silence it looks only 4 times a second.

/** Map the analyser's bins to columns: for each column the bin range (or, below a bin's width, an interpolation). */
export function spectrumColumns(cols, w, binCount, sampleRate) {
  const binHz = sampleRate / 2 / binCount;
  const lo = new Float32Array(cols);
  const hi = new Float32Array(cols);
  const tilt = new Float32Array(cols);
  for (let i = 0; i < cols; i++) {
    const x0 = ((i - 0.5) / (cols - 1)) * w;
    const x1 = ((i + 0.5) / (cols - 1)) * w;
    const f0 = eqHz(x0, w);
    const f1 = eqHz(x1, w);
    const fc = eqHz((i / (cols - 1)) * w, w);
    lo[i] = Math.min(binCount - 1, f0 / binHz);
    hi[i] = Math.min(binCount - 1, f1 / binHz);
    tilt[i] = TILT_DB_OCT * Math.log2(fc / 1000);
  }
  return { lo, hi, tilt };
}

/** One column's level (dB) from the bins: the loudest bin it spans, or the interpolated level where it spans less than one. */
export function columnLevel(buf, lo, hi) {
  const a = Math.floor(lo);
  const b = Math.ceil(hi);
  if (b - a <= 1) {
    const t = lo - a;
    const y0 = buf[a] ?? -Infinity;
    const y1 = buf[Math.min(buf.length - 1, a + 1)] ?? y0;
    return y0 + (y1 - y0) * t;
  }
  let m = -Infinity;
  for (let k = a; k <= b && k < buf.length; k++) if (buf[k] > m) m = buf[k];
  return m;
}

function syncLoop(wrap) {
  const st = state.get(wrap);
  if (!st) return;
  if (!st.control.spectrum) {
    stopSpectrum(wrap);
    return;
  }
  if (!st.spec) {
    st.spec = { analyser: null, buf: null, disp: null, map: null, raf: 0, timer: 0, last: 0, loud: 0, visible: false, io: null };
    const view = wrap.ownerDocument.defaultView;
    const IO = view?.IntersectionObserver;
    if (IO) {
      st.spec.io = new IO((entries) => {
        const s = state.get(wrap)?.spec;
        if (!s) return;
        s.visible = entries.some((e) => e.isIntersecting);
        kick(wrap);
      });
      st.spec.io.observe(wrap);
    } else st.spec.visible = true;
  }
  kick(wrap);
}

/** Start or stop the loop for where the graph is now. */
function kick(wrap) {
  const st = state.get(wrap);
  const s = st?.spec;
  if (!s) return;
  const doc = wrap.ownerDocument;
  const run = wrap.isConnected && s.visible && doc.visibilityState !== "hidden" && !!st.control.spectrum;
  if (!run) {
    halt(wrap);
    return;
  }
  if (!s.analyser) {
    s.source = st.control.spectrum;
    s.analyser = s.source.open?.() ?? null;
    if (!s.analyser) return;
    s.buf = new Float32Array(s.analyser.frequencyBinCount);
    s.loud = performanceNow(wrap);
    if (!s.onVis) {
      s.onVis = () => kick(wrap);
      doc.addEventListener("visibilitychange", s.onVis);
    }
  }
  if (!s.raf && !s.timer) schedule(wrap, false);
}

function performanceNow(wrap) {
  return wrap.ownerDocument.defaultView?.performance?.now() ?? Date.now();
}

function schedule(wrap, idle) {
  const s = state.get(wrap)?.spec;
  const view = wrap.ownerDocument.defaultView;
  if (!s || !view) return;
  if (idle) s.timer = view.setTimeout(() => ((s.timer = 0), frame(wrap, performanceNow(wrap))), IDLE_MS);
  else if (typeof view.requestAnimationFrame === "function")
    s.raf = view.requestAnimationFrame((t) => ((s.raf = 0), frame(wrap, t)));
  else s.timer = view.setTimeout(() => ((s.timer = 0), frame(wrap, performanceNow(wrap))), FRAME_MS);
}

/** Stop the loop and give the analyser back (it disconnects when nobody else has it open). */
function halt(wrap) {
  const s = state.get(wrap)?.spec;
  if (!s) return;
  const view = wrap.ownerDocument.defaultView;
  if (s.raf) view?.cancelAnimationFrame?.(s.raf);
  if (s.timer) view?.clearTimeout(s.timer);
  s.raf = 0;
  s.timer = 0;
  if (s.analyser) {
    s.source?.close?.();
    s.analyser = null;
    s.source = null;
  }
  if (s.disp) s.disp.fill(-Infinity);
  const canvas = wrap.querySelector(".nc-eq-spectrum");
  if (canvas instanceof HTMLCanvasElement) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

function stopSpectrum(wrap) {
  const s = state.get(wrap)?.spec;
  if (!s) return;
  halt(wrap);
  s.io?.disconnect();
  if (s.onVis) wrap.ownerDocument.removeEventListener("visibilitychange", s.onVis);
  const st = state.get(wrap);
  if (st) st.spec = null;
}

function frame(wrap, t) {
  const st = state.get(wrap);
  const s = st?.spec;
  if (!st || !s) return;
  if (!wrap.isConnected) {
    stopSpectrum(wrap);
    return;
  }
  if (!s.analyser) return;
  if (t - s.last < FRAME_MS - 4 && !s.idle) {
    schedule(wrap, false);
    return;
  }
  const dt = s.last ? Math.min(0.25, (t - s.last) / 1000) : FRAME_MS / 1000;
  s.last = t;
  const canvas = wrap.querySelector(".nc-eq-spectrum");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const { ctx, w, h } = fit(canvas);
  if (!ctx) return;
  const cols = Math.max(16, Math.round(w / 2));
  const sr = s.analyser.context?.sampleRate ?? st.control.sampleRate ?? 48000;
  if (!s.map || s.map.cols !== cols || s.map.w !== w || s.map.sr !== sr) {
    s.map = { cols, w, sr, ...spectrumColumns(cols, w, s.buf.length, sr) };
    s.disp = new Float32Array(cols).fill(-Infinity);
  }
  s.analyser.getFloatFrequencyData(s.buf);
  let peak = -Infinity;
  const fall = DECAY_DB_S * dt;
  const { lo, hi, tilt } = s.map;
  for (let i = 0; i < cols; i++) {
    const raw = columnLevel(s.buf, lo[i], hi[i]);
    if (raw > peak) peak = raw;
    const level = raw + tilt[i];
    const held = s.disp[i] - fall;
    s.disp[i] = level > held ? level : held;
  }
  if (peak > FLOOR_DB) s.loud = t;
  const silent = t - s.loud > SILENT_MS;
  ctx.clearRect(0, 0, w, h);
  if (!silent || s.disp.some((v) => v > SPEC_BOTTOM_DB)) drawSpectrum(ctx, w, h, s.disp, st.colours ?? colours(wrap));
  s.idle = silent && !s.disp.some((v) => v > SPEC_BOTTOM_DB);
  schedule(wrap, s.idle);
}

function drawSpectrum(ctx, w, h, disp, c) {
  const n = disp.length;
  const xs = new Array(n);
  const ys = new Array(n);
  // Smoothing across neighbours (a 5-tap window), so it reads as a shape, not a comb.
  const at = (i) => {
    const x = disp[Math.max(0, Math.min(n - 1, i))];
    return Number.isFinite(x) ? x : SPEC_BOTTOM_DB;
  };
  for (let i = 0; i < n; i++) {
    const v = at(i) * 0.36 + (at(i - 1) + at(i + 1)) * 0.22 + (at(i - 2) + at(i + 2)) * 0.1;
    const t = (Math.max(SPEC_BOTTOM_DB, Math.min(SPEC_TOP_DB, Number.isFinite(v) ? v : SPEC_BOTTOM_DB)) - SPEC_BOTTOM_DB) /
      (SPEC_TOP_DB - SPEC_BOTTOM_DB);
    xs[i] = (i / (n - 1)) * w;
    ys[i] = h - t * h;
  }
  ctx.save();
  ctx.fillStyle = c.spectrum;
  ctx.globalAlpha = 0.13;
  ctx.beginPath();
  tracePath(ctx, xs, ys);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = c.spectrum;
  ctx.lineWidth = 1;
  ctx.beginPath();
  tracePath(ctx, xs, ys);
  ctx.stroke();
  ctx.restore();
}

/** For tests: is the graph's spectrum loop running, and does it hold the analyser? */
export function eqSpectrumState(wrap) {
  const s = state.get(wrap)?.spec;
  return { running: !!(s && (s.raf || s.timer)), open: !!s?.analyser, idle: !!s?.idle };
}
