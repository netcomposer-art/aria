// nc-ui FX level (Peter, 2026-11-01: "For all the inserts add a small visual indicator (small bar graph indicator?)
// that shows the amount of signal being 'seen' in the insert"). A small vertical meter beside an FX card's switch, two
// thin bars: what goes into the effect (left) and what comes out (right). dB like the Studio's strips (−48 to 0 dBFS),
// peak ballistics like theirs (rises at once, falls back over motion-meter-fall), the hot colour (ASTRID's title orange) only within 1 dB
// of full scale (held for motion-meter-hold). A bypassed card keeps showing its input, dimmed by colour. Decorative
// (aria-hidden): the card's help words say what it is.
// nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.
//
// The host brings `meter: { open?(), close?(), read() }` (nc-fx's fxMeter(fx, id) is one): open() while the meter is
// on screen, close() after, read() the latest sample peaks as { in, out? } (1 = full scale) or a bare number (input
// only, one bar). Every meter on a page shares one loop, about 30 frames a second, that runs only while at least one is
// on screen and the page is visible, and looks only 4 times a second after a while of silence.
//
// Self-contained (no imports), so an app that vendors only this file (ASTRID's React Hacks panel) draws the same meter;
// it reads the --nc-ui-* custom properties from the live cascade.

/** The scale: the strips' meter range (dBFS). */
export const FX_LEVEL_FLOOR_DB = -48;
/** The clip colour shows from here up (dBFS). */
export const FX_LEVEL_CLIP_DB = -1;
const CLIP = 10 ** (FX_LEVEL_CLIP_DB / 20);
/** About 30 frames a second while sound flows; 4 a second after SILENT_MS of silence. */
const FRAME_MS = 32;
const IDLE_MS = 250;
const SILENT_MS = 1200;
/** Fallbacks for the motion tokens (seconds) when the cascade has none. */
const FALL_FALLBACK = 0.2;
const HOLD_FALLBACK = 1.5;

/** A sample peak (1 = full scale) as a 0..1 position on the −48..0 dBFS scale. */
export function fxLevelPosition(peak) {
  const p = Number(peak);
  if (!(p > 0)) return 0;
  const t = (20 * Math.log10(p) - FX_LEVEL_FLOOR_DB) / -FX_LEVEL_FLOOR_DB;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** The meter element: two bars (in, out), each a track with a fill the loop scales. */
export function createFxLevel(doc = globalThis.document) {
  const el = doc.createElement("span");
  el.className = "nc-fx-level";
  el.setAttribute("aria-hidden", "true");
  el.dataset.ncRows = "2";
  for (const which of ["in", "out"]) {
    const bar = doc.createElement("span");
    bar.className = "nc-fx-level-bar";
    bar.dataset.ncLevel = which;
    const fill = doc.createElement("span");
    fill.className = "nc-fx-level-fill";
    bar.append(fill);
    el.append(bar);
  }
  return el;
}

const RECS = new WeakMap(); // element -> its record
const LOOPS = new WeakMap(); // document -> the shared loop

function seconds(el, name, fallback) {
  const view = el.ownerDocument?.defaultView;
  if (typeof view?.getComputedStyle !== "function") return fallback;
  const raw = String(view.getComputedStyle(el).getPropertyValue(`--nc-ui-${name}`) ?? "").trim();
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n / 1000 : n;
}

function loopOf(doc) {
  let loop = LOOPS.get(doc);
  if (loop) return loop;
  const view = doc.defaultView;
  loop = { doc, recs: new Set(), io: null, raf: 0, timer: 0, last: 0, loud: 0, idle: false, frames: 0 };
  const IO = view?.IntersectionObserver;
  if (IO)
    loop.io = new IO((entries) => {
      for (const e of entries) {
        const rec = RECS.get(e.target);
        if (!rec) continue;
        rec.seen.set(e.target, e.isIntersecting);
        sync(rec);
      }
      kick(loop);
    });
  doc.addEventListener("visibilitychange", () => {
    for (const rec of loop.recs) sync(rec);
    kick(loop);
  });
  LOOPS.set(doc, loop);
  return loop;
}

const connected = (rec) => rec.els.some((el) => el.isConnected);
/** On screen: any of its elements intersecting (IntersectionObserver), or connected where there is none. */
function onScreen(rec) {
  if (!rec.loop.io) return connected(rec);
  for (const el of rec.els) if (rec.seen.get(el) === true && el.isConnected) return true;
  return false;
}

/** Open or close the source for where the meter is now. */
function sync(rec) {
  const want = !rec.dead && !!rec.source && onScreen(rec) && rec.loop.doc.visibilityState !== "hidden";
  if (want && !rec.open) {
    const ok = typeof rec.source.open === "function" ? rec.source.open() : true;
    rec.open = ok !== false;
    if (rec.open) rec.loop.loud = now(rec.loop);
  } else if (!want && rec.open) {
    rec.open = false;
    rec.source?.close?.();
    rest(rec);
  }
}

function now(loop) {
  return loop.doc.defaultView?.performance?.now() ?? Date.now();
}

function kick(loop) {
  let any = false;
  for (const rec of loop.recs) if (rec.open) any = true;
  if (!any) {
    halt(loop);
    return;
  }
  if (loop.idle && loop.timer) {
    // Woken (a meter came on screen): look now.
    loop.doc.defaultView?.clearTimeout(loop.timer);
    loop.timer = 0;
    loop.idle = false;
    loop.loud = now(loop);
  }
  if (!loop.raf && !loop.timer) schedule(loop, false);
}

function schedule(loop, idle) {
  const view = loop.doc.defaultView;
  if (!view) return;
  const tick = () => frame(loop, now(loop));
  if (idle) loop.timer = view.setTimeout(() => ((loop.timer = 0), tick()), IDLE_MS);
  else if (typeof view.requestAnimationFrame === "function")
    loop.raf = view.requestAnimationFrame((t) => ((loop.raf = 0), frame(loop, t)));
  else loop.timer = view.setTimeout(() => ((loop.timer = 0), tick()), FRAME_MS);
}

function halt(loop) {
  const view = loop.doc.defaultView;
  if (loop.raf) view?.cancelAnimationFrame?.(loop.raf);
  if (loop.timer) view?.clearTimeout(loop.timer);
  loop.raf = 0;
  loop.timer = 0;
  loop.idle = false;
  loop.last = 0;
}

function frame(loop, t) {
  if (t - loop.last < FRAME_MS - 4 && !loop.idle && loop.last) {
    schedule(loop, false);
    return;
  }
  const dt = loop.last ? Math.min(0.25, (t - loop.last) / 1000) : FRAME_MS / 1000;
  loop.last = t;
  loop.frames++;
  let showing = false;
  let any = false;
  for (const rec of loop.recs) {
    if (!connected(rec)) {
      // Gone from the page (a re-render replaced it): give the source back and forget it. One that was never in the
      // page yet (built, not placed) gets a few seconds' grace.
      if (rec.placed || loop.frames - rec.born > 90) detach(rec);
      continue;
    }
    rec.placed = true;
    if (!rec.open) continue;
    any = true;
    if (step(rec, dt, t)) loop.loud = t;
    if (rec.disp[0] > 0 || rec.disp[1] > 0) showing = true;
  }
  if (!any) {
    halt(loop);
    return;
  }
  loop.idle = t - loop.loud > SILENT_MS && !showing;
  schedule(loop, loop.idle);
}

/** One frame of one meter: read, ballistics, paint. True if it heard anything above the floor. */
function step(rec, dt, t) {
  if (rec.fall < 0) {
    const el = rec.els[0];
    rec.fall = seconds(el, "motion-meter-fall", FALL_FALLBACK);
    rec.hold = seconds(el, "motion-meter-hold", HOLD_FALLBACK);
  }
  let v = null;
  try {
    v = rec.source.read();
  } catch {
    v = null;
  }
  const single = typeof v === "number";
  const raw0 = single ? v : Number(v?.in) || 0;
  const hasOut = !single && v !== null && typeof v === "object" && typeof v.out === "number";
  const raw1 = hasOut ? Number(v.out) || 0 : 0;
  const rows = hasOut ? "2" : "1";
  if (rec.rows !== rows) {
    rec.rows = rows;
    for (const el of rec.els) el.dataset.ncRows = rows;
  }
  const decay = rec.fall > 0 ? Math.exp(-dt / rec.fall) : 0;
  const raws = [raw0, raw1];
  let heard = false;
  for (let i = 0; i < 2; i++) {
    const p = fxLevelPosition(raws[i]);
    if (p > 0) heard = true;
    rec.disp[i] = p >= rec.disp[i] ? p : p + (rec.disp[i] - p) * decay;
    if (rec.disp[i] < 0.001) rec.disp[i] = 0;
    if (raws[i] >= CLIP) rec.clipAt[i] = t;
    const clip = rec.clipAt[i] > 0 && t - rec.clipAt[i] < rec.hold * 1000;
    paint(rec, i, rec.disp[i], clip);
  }
  return heard;
}

function paint(rec, i, value, clip) {
  const v = Math.round(value * 1000) / 1000;
  const c = clip ? "true" : "false";
  if (rec.shown[i] === v && rec.clipShown[i] === c) return;
  rec.shown[i] = v;
  rec.clipShown[i] = c;
  for (const el of rec.els) {
    const fill = el.children[i]?.firstElementChild;
    if (!fill) continue;
    fill.style.transform = `scaleY(${v})`;
    fill.dataset.clip = c;
  }
}

function rest(rec) {
  rec.disp[0] = 0;
  rec.disp[1] = 0;
  rec.clipAt[0] = 0;
  rec.clipAt[1] = 0;
  paint(rec, 0, 0, false);
  paint(rec, 1, 0, false);
}

function detach(rec) {
  if (rec.open) {
    rec.open = false;
    rec.source?.close?.();
  }
  rec.dead = true;
  rec.loop.recs.delete(rec);
  for (const el of rec.els) {
    rec.loop.io?.unobserve(el);
    if (RECS.get(el) === rec) RECS.delete(el);
  }
}

/**
 * Drive one or more meter elements (createFxLevel) from a source: the host's `{ open?(), close?(), read() }`. The
 * elements show the same levels (a card's header meter and its folded column's); the source is open while any of them
 * is on screen. Returns { set(source), destroy() }; a source of the same identity changes nothing.
 */
export function bindFxLevel(els, source) {
  const list = (Array.isArray(els) ? els : [els]).filter(Boolean);
  const doc = list[0]?.ownerDocument ?? globalThis.document;
  const loop = loopOf(doc);
  const rec = {
    els: list, source: source ?? null, loop, open: false, dead: false, seen: new Map(),
    born: loop.frames, placed: false, disp: [0, 0], shown: [-1, -1], clipShown: ["", ""], clipAt: [0, 0], fall: -1, hold: HOLD_FALLBACK, rows: "",
  };
  for (const el of list) {
    RECS.set(el, rec);
    loop.io?.observe(el);
  }
  loop.recs.add(rec);
  rest(rec);
  // Without an IntersectionObserver: look once the elements are in the page.
  if (!loop.io) {
    const view = doc.defaultView;
    const later = () => {
      sync(rec);
      kick(loop);
    };
    if (typeof view?.requestAnimationFrame === "function") view.requestAnimationFrame(later);
    else setTimeout(later, 0);
  }
  return {
    set(next) {
      const src = next ?? null;
      if (rec.dead) return;
      if (src === rec.source) {
        // Same source: only look again (a patch after the card went into the page opens it where nothing observes).
        sync(rec);
        kick(loop);
        return;
      }
      if (rec.open) {
        rec.open = false;
        rec.source?.close?.();
        rest(rec);
      }
      rec.source = src;
      sync(rec);
      kick(loop);
    },
    destroy() {
      if (!rec.dead) detach(rec);
      kick(loop);
    },
  };
}

/** For tests: does the meter hold its source open, is the shared loop running (idle: the slow look), what it shows. */
export function fxLevelState(el) {
  const rec = RECS.get(el);
  const loop = rec?.loop ?? LOOPS.get(el?.ownerDocument);
  return {
    open: !!rec?.open,
    running: !!(loop && (loop.raf || loop.timer)),
    idle: !!loop?.idle,
    meters: loop ? loop.recs.size : 0,
    shown: rec ? [...rec.disp] : [0, 0],
  };
}
