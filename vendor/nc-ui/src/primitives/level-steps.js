// nc-ui level steps (Peter, 2026-11-06: Gate's step strip, "tap/drag to draw levels"): a row of steps, each a level
// (0..1) drawn as a soft bar with its shape's curve over it, the playhead on the step playing (solid when locked to
// Play, dimmed while it runs free), and under it the shapes as tabs.
//
// The kit draws; the host owns the state and the maths. The control brings the steps ({ level, shape }), the curve
// of each step (`curve(i, n)`: n + 1 samples 0..1 across the step, so a Glide can lean into the next step), and the
// handlers: `onLevels(levels, done)` while a finger or the mouse draws (done on release), `onShape(i, shape)` from a
// long-press (or right-click, or Enter) on a step, `onShapeAll(shape)` from the tabs. `playhead()` is read about 30
// times a second while the strip is on the page: { step, locked } or null.
// nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.

const state = new WeakMap();
/** Long-press time (ms) and how far a press may wander (px) before it is a drag instead. */
export const LONG_PRESS_MS = 450;
export const PRESS_SLOP = 6;
/** Playhead frames (ms). */
const FRAME_MS = 33;
/** The curve's resolution per step. */
const CURVE_N = 24;
const NS = "http://www.w3.org/2000/svg";

/** A level (0..1, whole percents) from a y in a plot of height h. */
export function levelAt(y, h) {
  const v = 1 - y / Math.max(1, h);
  return Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
}
/** Which step an x falls in, given the steps' right edges (ascending, in the same units). */
export function stepAt(x, rights) {
  for (let i = 0; i < rights.length; i++) if (x < rights[i]) return i;
  return rights.length - 1;
}
/** Levels with steps a..b (either order) drawn on a straight line from level la (at a) to lb (at b). */
export function drawLine(levels, a, la, b, lb) {
  const out = levels.slice();
  if (a === b) { out[b] = lb; return out; }
  const step = a < b ? 1 : -1;
  for (let i = a; i !== b + step; i += step) {
    const t = (i - a) / (b - a);
    out[i] = Math.round((la + (lb - la) * t) * 100) / 100;
  }
  return out;
}
/** "Step 3 of 16: 85%, Pump". */
function stepText(control, i) {
  const s = control.steps[i];
  const shape = (control.shapes ?? []).find((o) => o.value === s.shape);
  const out = control.played !== undefined && i >= control.played ? ", not playing" : "";
  return `Step ${i + 1} of ${control.steps.length}: ${Math.round(s.level * 100)}%${shape ? `, ${shape.label}` : ""}${out}`;
}
function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
function icon(path) {
  const s = svgEl("svg", { class: "nc-lsteps-ico", viewBox: "0 0 20 10", "aria-hidden": "true", focusable: "false" });
  s.append(svgEl("path", { d: path }));
  return s;
}

export function renderLevelSteps(control, lookup) {
  const wrap = document.createElement("div");
  wrap.className = "nc-lsteps";
  wrap.dataset.ncId = control.id;
  wrap.dataset.ncLsteps = "";
  wrap.setAttribute("role", "group");
  const plot = document.createElement("div");
  plot.className = "nc-lsteps-plot";
  plot.tabIndex = 0;
  plot.setAttribute("role", "slider");
  plot.setAttribute("aria-orientation", "vertical");
  plot.setAttribute("aria-valuemin", "0");
  plot.setAttribute("aria-valuemax", "100");
  plot.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Enter");
  const axis = document.createElement("div");
  axis.className = "nc-lsteps-axis";
  axis.setAttribute("aria-hidden", "true");
  const shapes = document.createElement("div");
  shapes.className = "nc-lsteps-shapes";
  shapes.setAttribute("role", "tablist");
  const pick = document.createElement("div");
  pick.className = "nc-lsteps-pick";
  pick.setAttribute("role", "menu");
  pick.hidden = true;
  wrap.append(plot, axis, shapes, pick);
  const probeEl = document.createElement("i");
  probeEl.className = "nc-token-probe";
  probeEl.dataset.ncProbe = "";
  wrap.append(probeEl);
  const st = { control, lookup, focus: 0, drag: null, timer: 0, loop: 0, last: -2, lastLocked: null, count: -1, shapeKey: "", outside: null };
  state.set(wrap, st);
  bindPlot(wrap, plot);
  bindPick(wrap, pick);
  patchLevelSteps(wrap, control);
  return wrap;
}

function live(wrap) {
  const st = state.get(wrap);
  const c = st?.lookup?.(wrap);
  return c?.type === "levelSteps" ? c : st?.control;
}
function rights(plot) {
  return [...plot.querySelectorAll(".nc-lsteps-step")].map((el) => el.getBoundingClientRect().right);
}
/** The step under a pointer and the level at its height, measured on the steps themselves (inside the plot's pad). */
function point(plot, e) {
  const first = plot.querySelector(".nc-lsteps-step");
  const box = (first ?? plot).getBoundingClientRect();
  const cols = rights(plot);
  return { i: stepAt(e.clientX, cols), level: levelAt(e.clientY - box.top, box.height) };
}

function bindPlot(wrap, plot) {
  const st = state.get(wrap);
  const clearTimer = () => { if (st.timer) { clearTimeout(st.timer); st.timer = 0; } };
  plot.addEventListener("pointerdown", (e) => {
    const c = live(wrap);
    if (!c || e.button > 0 || !c.steps.length) return;
    e.preventDefault();
    closePick(wrap);
    plot.setPointerCapture?.(e.pointerId);
    const p = point(plot, e);
    const start = c.steps.map((s) => s.level);
    st.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start, levels: start, i: p.i, level: p.level, moved: false, long: false };
    st.focus = p.i;
    draw(wrap, p.i, p.level, p.i, p.level, false);
    clearTimer();
    st.timer = setTimeout(() => {
      st.timer = 0;
      const d = st.drag;
      if (!d || d.moved) return;
      d.long = true;
      // A long press is for the shape, not the level: put the level back and open the picker on that step.
      live(wrap)?.onLevels(d.start.slice(), true);
      openPick(wrap, d.i);
    }, LONG_PRESS_MS);
  });
  plot.addEventListener("pointermove", (e) => {
    const d = st.drag;
    if (!d || d.id !== e.pointerId || d.long) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < PRESS_SLOP) return;
    d.moved = true;
    clearTimer();
    const p = point(plot, e);
    draw(wrap, d.i, d.level, p.i, p.level, false);
    d.i = p.i;
    d.level = p.level;
  });
  const end = (e) => {
    const d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    clearTimer();
    st.drag = null;
    plot.releasePointerCapture?.(e.pointerId);
    if (!d.long) live(wrap)?.onLevels(d.levels.slice(), true);
    showDragging(wrap, -1);
  };
  plot.addEventListener("pointerup", end);
  plot.addEventListener("pointercancel", (e) => {
    const d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    clearTimer();
    st.drag = null;
    if (!d.long) live(wrap)?.onLevels(d.start.slice(), true); // the page took the touch: nothing drawn
    showDragging(wrap, -1);
  });
  plot.addEventListener("contextmenu", (e) => {
    const c = live(wrap);
    if (!c?.onShape) return;
    e.preventDefault();
    openPick(wrap, point(plot, e).i);
  });
  plot.addEventListener("keydown", (e) => {
    const c = live(wrap);
    if (!c || !c.steps.length) return;
    const n = c.steps.length;
    const i = Math.min(st.focus, n - 1);
    const lv = c.steps[i].level;
    const set = (v) => {
      const levels = c.steps.map((s) => s.level);
      levels[i] = Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
      c.onLevels(levels, true);
    };
    switch (e.key) {
      case "ArrowLeft": st.focus = (i - 1 + n) % n; break;
      case "ArrowRight": st.focus = (i + 1) % n; break;
      case "ArrowUp": set(lv + (e.shiftKey ? 0.01 : 0.05)); break;
      case "ArrowDown": set(lv - (e.shiftKey ? 0.01 : 0.05)); break;
      case "PageUp": set(lv + 0.25); break;
      case "PageDown": set(lv - 0.25); break;
      case "Home": set(1); break;
      case "End": set(0); break;
      case "Enter":
      case " ":
        if (!c.onShape) return;
        openPick(wrap, i);
        break;
      default:
        return;
    }
    e.preventDefault();
    showFocus(wrap);
  });
  plot.addEventListener("focus", () => showFocus(wrap));
  plot.addEventListener("blur", () => { for (const el of plot.querySelectorAll("[data-focus]")) el.removeAttribute("data-focus"); });
}

/** Draw from (a, la) to (b, lb) into the drag's levels and hand them to the host. */
function draw(wrap, a, la, b, lb, done) {
  const st = state.get(wrap);
  const d = st.drag;
  if (!d) return;
  d.levels = drawLine(d.levels, a, la, b, lb);
  showDragging(wrap, b, d.levels[b]);
  live(wrap)?.onLevels(d.levels.slice(), done);
}
function showDragging(wrap, i, level) {
  for (const el of wrap.querySelectorAll(".nc-lsteps-step")) {
    if (Number(el.dataset.i) === i) {
      el.dataset.dragging = "true";
      el.dataset.level = `${Math.round(level * 100)}%`;
    } else el.removeAttribute("data-dragging");
  }
}
function showFocus(wrap) {
  const st = state.get(wrap);
  const plot = wrap.querySelector(".nc-lsteps-plot");
  const c = live(wrap);
  if (!plot || !c) return;
  for (const el of plot.querySelectorAll(".nc-lsteps-step")) {
    if (Number(el.dataset.i) === st.focus) el.dataset.focus = "true";
    else el.removeAttribute("data-focus");
  }
  const i = Math.min(st.focus, c.steps.length - 1);
  plot.setAttribute("aria-valuenow", String(Math.round((c.steps[i]?.level ?? 0) * 100)));
  plot.setAttribute("aria-valuetext", stepText(c, i));
}

function bindPick(wrap, pick) {
  pick.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); closePick(wrap, true); return; }
    const items = [...pick.querySelectorAll("button")];
    const at = items.indexOf(e.target);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); items[(at + 1) % items.length]?.focus(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus(); }
  });
  // A press anywhere else closes it (listened for only while it is open).
  state.get(wrap).outside = (e) => {
    if (!pick.hidden && !pick.contains(e.target)) closePick(wrap);
  };
}
/** The shape picker for step i: the shapes as buttons, over the step (a small popover; it fits the card on a phone). */
function openPick(wrap, i) {
  const c = live(wrap);
  const pick = wrap.querySelector(".nc-lsteps-pick");
  const plot = wrap.querySelector(".nc-lsteps-plot");
  if (!c?.onShape || !pick || !plot) return;
  const st = state.get(wrap);
  st.focus = i;
  pick.textContent = "";
  const head = document.createElement("span");
  head.className = "nc-lsteps-pick-head";
  head.textContent = `Step ${i + 1}`;
  pick.append(head);
  for (const o of c.shapes ?? []) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitemradio");
    b.setAttribute("aria-checked", c.steps[i]?.shape === o.value ? "true" : "false");
    if (o.icon) b.append(icon(o.icon));
    b.append(document.createTextNode(o.label));
    b.addEventListener("click", () => {
      live(wrap)?.onShape?.(i, o.value);
      closePick(wrap, true);
    });
    pick.append(b);
  }
  pick.setAttribute("aria-label", `Shape of step ${i + 1}`);
  pick.hidden = false;
  wrap.ownerDocument.addEventListener("pointerdown", st.outside, true);
  // Centred over the step, kept inside the strip.
  const col = plot.querySelector(`.nc-lsteps-step[data-i="${i}"]`);
  const wb = wrap.getBoundingClientRect();
  const cb = col?.getBoundingClientRect();
  const pw = pick.getBoundingClientRect().width;
  const mid = cb ? cb.left + cb.width / 2 - wb.left : 0;
  const left = Math.max(0, Math.min(wb.width - pw, mid - pw / 2));
  pick.style.setProperty("--nc-lsteps-pick-x", `${Math.round(left)}px`);
  pick.querySelector('[aria-checked="true"]')?.focus?.() ?? pick.querySelector("button")?.focus?.();
}
function closePick(wrap, refocus = false) {
  const pick = wrap.querySelector(".nc-lsteps-pick");
  if (!pick || pick.hidden) return;
  wrap.ownerDocument.removeEventListener("pointerdown", state.get(wrap).outside, true);
  pick.hidden = true;
  pick.textContent = "";
  if (refocus) wrap.querySelector(".nc-lsteps-plot")?.focus?.();
}

/** Columns for n steps (rebuilt only when n changes). */
function columns(wrap, n) {
  const st = state.get(wrap);
  const plot = wrap.querySelector(".nc-lsteps-plot");
  const axis = wrap.querySelector(".nc-lsteps-axis");
  if (st.count === n) return;
  st.count = n;
  plot.textContent = "";
  axis.textContent = "";
  for (let i = 0; i < n; i++) {
    const col = document.createElement("div");
    col.className = "nc-lsteps-step";
    col.dataset.i = String(i);
    if (i % 4 === 0 && i > 0) col.dataset.beat = "true";
    const s = svgEl("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
    s.append(
      svgEl("rect", { class: "nc-lsteps-level", x: 0, y: 100, width: 100, height: 0 }),
      svgEl("path", { class: "nc-lsteps-env", d: "" }),
      svgEl("path", { class: "nc-lsteps-top", d: "" }),
      svgEl("line", { class: "nc-lsteps-floor", x1: 0, y1: 100, x2: 100, y2: 100 }),
    );
    col.append(s);
    plot.append(col);
    const tick = document.createElement("span");
    if (i % 4 === 0) tick.textContent = String(i + 1);
    if (i % 4 === 0 && i > 0) tick.dataset.beat = "true";
    axis.append(tick);
  }
}

export function patchLevelSteps(wrap, control) {
  const st = state.get(wrap);
  if (!st) return;
  st.control = control;
  const n = control.steps.length;
  columns(wrap, n);
  wrap.setAttribute("aria-label", control.label ?? "Steps");
  if (control.help) wrap.setAttribute("data-nc-help", control.help);
  else wrap.removeAttribute("data-nc-help");
  wrap.dataset.on = control.on === false ? "false" : "true";
  const plot = wrap.querySelector(".nc-lsteps-plot");
  plot.setAttribute("aria-label", control.label ?? "Steps");
  // Swing: the first step of each pair takes `swing` of the pair (0.5 = straight).
  const sw = Math.max(0.5, Math.min(0.75, control.swing ?? 0.5));
  const cols = plot.querySelectorAll(".nc-lsteps-step");
  const ticks = wrap.querySelectorAll(".nc-lsteps-axis > span");
  control.steps.forEach((s, i) => {
    const col = cols[i];
    if (!col) return;
    const grow = String((i % 2 ? 1 - sw : sw) * 2);
    col.style.setProperty("--nc-lsteps-grow", grow);
    ticks[i]?.style.setProperty("--nc-lsteps-grow", grow);
    const out = control.played !== undefined && i >= control.played;
    if (out) col.dataset.out = "true";
    else col.removeAttribute("data-out");
    col.dataset.zero = s.level <= 0 ? "true" : "false";
    const lv = Math.max(0, Math.min(1, s.level));
    const rect = col.querySelector(".nc-lsteps-level");
    rect.setAttribute("y", String(100 - lv * 100));
    rect.setAttribute("height", String(lv * 100));
    const ys = control.curve ? control.curve(i, CURVE_N) : null;
    let env = "M0 100";
    let top = "";
    for (let k = 0; k <= CURVE_N; k++) {
      const g = ys ? Math.max(0, Math.min(1, ys[k] ?? lv)) : lv;
      const x = (k / CURVE_N) * 100;
      const y = 100 - g * 100;
      env += ` L${x.toFixed(2)} ${y.toFixed(2)}`;
      top += `${k ? " L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    col.querySelector(".nc-lsteps-env").setAttribute("d", `${env} L100 100 Z`);
    col.querySelector(".nc-lsteps-top").setAttribute("d", top);
  });
  // The shape tabs: the shape every step has, or none selected when they differ.
  const tabs = wrap.querySelector(".nc-lsteps-shapes");
  const key = (control.shapes ?? []).map((o) => `${o.value}:${o.label}`).join();
  if (key !== st.shapeKey) {
    st.shapeKey = key;
    tabs.textContent = "";
    for (const o of control.shapes ?? []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nc-lsteps-shape";
      b.setAttribute("role", "tab");
      b.dataset.shape = String(o.value);
      if (o.icon) b.append(icon(o.icon));
      b.append(document.createTextNode(o.label));
      b.addEventListener("click", () => live(wrap)?.onShapeAll?.(o.value));
      tabs.append(b);
    }
  }
  tabs.hidden = !(control.shapes?.length && control.onShapeAll);
  tabs.setAttribute("aria-label", control.shapesLabel ?? "Shape of every step");
  const played = control.played ?? n;
  const first = control.steps[0]?.shape;
  const same = control.steps.slice(0, played).every((s) => s.shape === first);
  for (const b of tabs.querySelectorAll(".nc-lsteps-shape")) {
    const on = same && b.dataset.shape === String(first);
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.tabIndex = on || (!same && b === tabs.firstElementChild) ? 0 : -1;
  }
  if (st.focus >= n) st.focus = 0;
  showFocus(wrap);
  st.last = -2;
  syncLoop(wrap);
}

/** The playhead: read control.playhead() about 30 times a second while the strip is on the page. */
function syncLoop(wrap) {
  const st = state.get(wrap);
  const win = wrap.ownerDocument?.defaultView;
  if (!st || st.loop || !st.control.playhead || !win?.requestAnimationFrame) {
    if (st && !st.control.playhead) showPlayhead(wrap, null);
    return;
  }
  let at = 0;
  const tick = (t) => {
    st.loop = 0;
    if (!wrap.isConnected || !st.control.playhead) { showPlayhead(wrap, null); return; }
    if (t - at >= FRAME_MS) {
      at = t;
      showPlayhead(wrap, st.control.playhead());
    }
    st.loop = win.requestAnimationFrame(tick);
  };
  st.loop = win.requestAnimationFrame(tick);
}
function showPlayhead(wrap, ph) {
  const st = state.get(wrap);
  const step = ph && Number.isInteger(ph.step) ? ph.step : -1;
  const locked = !!ph?.locked;
  if (st.last === step && st.lastLocked === locked) return;
  st.last = step;
  st.lastLocked = locked;
  for (const el of wrap.querySelectorAll(".nc-lsteps-step")) {
    if (Number(el.dataset.i) === step) {
      el.dataset.playhead = "true";
      el.dataset.locked = locked ? "true" : "false";
    } else {
      el.removeAttribute("data-playhead");
      el.removeAttribute("data-locked");
    }
  }
  wrap.dataset.free = ph && !locked ? "true" : "false";
}

/** For tests: the strip's state. */
export function levelStepsState(wrap) {
  const st = state.get(wrap);
  return st ? { focus: st.focus, dragging: !!st.drag, picking: !wrap.querySelector(".nc-lsteps-pick")?.hidden } : null;
}
