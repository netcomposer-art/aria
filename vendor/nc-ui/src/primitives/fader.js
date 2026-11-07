// A console fader: vertical, a flat rectangular cap with a line across its centre (a mixing desk's fader, not the
// round slider thumb, which stays as it is everywhere else). Styles are in kit.js (.nc-fader); every length and
// colour is a token.
//
// The value is a 0..1 position (bottom to top). The host owns the law (dB per position) and passes the text the
// readout and screen readers show. Dragging is relative, as on a desk: grab the cap anywhere and it moves with the
// hand; press the slot away from the cap and the cap jumps there first. Shift drags (and steps) four times finer.
// Double-click resets (onReset). Arrows step, Page Up/Down step ten, Home/End go to the ends.

const handles = new WeakMap();
/** Shift: four times finer, on drag and on the arrow keys. */
const FINE = 0.25;

/**
 * @param {{
 *   label: string,
 *   value?: number,
 *   step?: number,
 *   valueText?: string,
 *   onChange?: (value: number) => void,
 *   onReset?: () => void,
 *   doc?: Document,
 * }} options
 */
export function createFader(options) {
  const doc = options.doc ?? globalThis.document;
  const el = doc.createElement("div");
  el.className = "nc-fader";
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-orientation", "vertical");
  el.setAttribute("aria-valuemin", "0");
  el.setAttribute("aria-valuemax", "1");
  const track = doc.createElement("span");
  track.className = "nc-fader-track";
  track.setAttribute("aria-hidden", "true");
  const cap = doc.createElement("span");
  cap.className = "nc-fader-cap";
  cap.setAttribute("aria-hidden", "true");
  el.append(track, cap);

  let value = 0;
  let step = options.step ?? 0.005;
  let onChange = options.onChange;
  let onReset = options.onReset;
  const clamp = (v) => Math.min(1, Math.max(0, v));

  const paint = () => {
    el.style.setProperty("--fader-pos", String(value));
    el.setAttribute("aria-valuenow", String(Math.round(value * 1000) / 1000));
  };
  const commit = (next) => {
    const v = clamp(next);
    if (v === value) return;
    value = v;
    paint();
    onChange?.(v);
  };

  // Relative drag: the position moves by the pointer's travel over the slot height.
  let lastY = 0;
  let dragging = false;
  el.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    el.focus?.({ preventScroll: true });
    const box = el.getBoundingClientRect();
    if (event.target !== cap && box.height > 0) commit(1 - (event.clientY - box.top) / box.height);
    lastY = event.clientY;
    dragging = true;
    el.dataset.dragging = "true";
    el.setPointerCapture?.(event.pointerId);
  });
  el.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const height = el.getBoundingClientRect().height || 1;
    const delta = ((lastY - event.clientY) / height) * (event.shiftKey ? FINE : 1);
    lastY = event.clientY;
    commit(value + delta);
  });
  const end = () => {
    dragging = false;
    delete el.dataset.dragging;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("lostpointercapture", end);
  el.addEventListener("dblclick", (event) => {
    event.preventDefault();
    onReset?.();
  });
  el.addEventListener("keydown", (event) => {
    const fine = event.shiftKey ? step * FINE : step;
    const moves = {
      ArrowUp: value + fine,
      ArrowRight: value + fine,
      ArrowDown: value - fine,
      ArrowLeft: value - fine,
      PageUp: value + step * 10,
      PageDown: value - step * 10,
      Home: 0,
      End: 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    commit(moves[event.key]);
  });

  const handle = {
    el,
    get value() {
      return value;
    },
    get dragging() {
      return dragging;
    },
    /** Move the cap without calling onChange. Ignored while a hand holds the cap, so the host can't fight it. */
    set(next) {
      if (dragging) return;
      value = clamp(Number(next) || 0);
      paint();
    },
    setText(text) {
      if (text) el.setAttribute("aria-valuetext", text);
      else el.removeAttribute("aria-valuetext");
    },
    setLabel(text) {
      el.setAttribute("aria-label", text);
    },
    configure(next) {
      if (typeof next.step === "number" && next.step > 0) step = next.step;
      if (next.onChange) onChange = next.onChange;
      if (next.onReset) onReset = next.onReset;
    },
  };
  handle.setLabel(options.label);
  handle.set(options.value ?? 0);
  handle.setText(options.valueText);
  handles.set(el, handle);
  return handle;
}

/** The handle of a fader made by createFader (or by a strip control), from its element. */
export function faderHandle(el) {
  return handles.get(el);
}
