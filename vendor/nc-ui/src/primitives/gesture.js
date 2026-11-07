// nc-ui pad gesture recogniser: tap, long-press, axis-locked value drag, and horizontal paint.
// Olive's recogniser from ASTRID-Bass (apps/bass/src/modules/step-grid/recognizer.ts, design §4.5),
// moved into nc-ui so Bass and Rhythm share one implementation. PadGesture is pure: feed it pointer
// samples and a clock, it emits intents; no DOM, no timers. bindPadGesture is the thin DOM layer.

export const DEFAULT_GESTURE = { slop: 8, longPressMs: 500, pitchPx: 16 };

export class PadGesture {
  /**
   * @param {(x: number, y: number) => number} hit pad index under a point, or -1
   * @param {(intent: import("./gesture").GestureIntent) => void} emit
   * @param {import("./gesture").GestureConfig} [config]
   */
  constructor(hit, emit, config = DEFAULT_GESTURE) {
    this.hit = hit;
    this.emit = emit;
    this.config = config;
    this.phase = "idle";
    this.pointer = -1;
    this.pad = -1;
    this.x0 = 0;
    this.y0 = 0;
    this.t0 = 0;
    this.degrees = 0;
    this.lastPad = -1;
  }

  get state() {
    return this.phase;
  }

  /** Returns true when this pointer was taken (only the first pointer counts). */
  down(id, x, y, t) {
    if (this.phase !== "idle") return false;
    const pad = this.hit(x, y);
    if (pad < 0) return false;
    this.phase = "pending";
    this.pointer = id;
    this.pad = pad;
    this.x0 = x;
    this.y0 = y;
    this.t0 = t;
    this.degrees = 0;
    return true;
  }

  /** Call from a timer at down + longPressMs (and any time after). */
  tick(t) {
    if (this.phase === "pending" && t - this.t0 >= this.config.longPressMs) {
      this.phase = "long";
      this.emit({ kind: "long", pad: this.pad });
    }
  }

  move(id, x, y, t) {
    if (id !== this.pointer) return;
    const dx = x - this.x0;
    const dy = y - this.y0;
    if (this.phase === "pending") {
      this.tick(t);
      if (this.phase !== "pending") return;
      if (Math.hypot(dx, dy) < this.config.slop) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        this.phase = "pitch";
      } else {
        this.phase = "paint";
        this.lastPad = this.pad;
        this.emit({ kind: "paint", pad: this.pad, phase: "start" });
      }
    }
    if (this.phase === "pitch") {
      const degrees = Math.trunc(-dy / this.config.pitchPx);
      if (degrees !== this.degrees) {
        this.degrees = degrees;
        this.emit({ kind: "pitch", pad: this.pad, degrees, phase: "move" });
      }
    } else if (this.phase === "paint") {
      const pad = this.hit(x, y);
      if (pad >= 0 && pad !== this.lastPad) {
        this.lastPad = pad;
        this.emit({ kind: "paint", pad, phase: "enter" });
      }
    }
  }

  up(id, x, y, t) {
    if (id !== this.pointer) return;
    if (this.phase === "pending") this.move(id, x, y, t);
    if (this.phase === "pending") this.emit({ kind: "tap", pad: this.pad });
    else if (this.phase === "pitch")
      this.emit({ kind: "pitch", pad: this.pad, degrees: this.degrees, phase: "commit" });
    else if (this.phase === "paint") this.emit({ kind: "paint-end" });
    this.reset();
  }

  cancel(id) {
    if (id !== this.pointer) return;
    if (this.phase === "pitch")
      this.emit({ kind: "pitch", pad: this.pad, degrees: 0, phase: "cancel" });
    else if (this.phase === "paint") this.emit({ kind: "paint-end" });
    this.reset();
  }

  reset() {
    this.phase = "idle";
    this.pointer = -1;
    this.pad = -1;
    this.lastPad = -1;
    this.degrees = 0;
  }
}

/**
 * Wire a PadGesture to a container with Pointer Events. `selector` finds the pads; the pad index is
 * the element's position in that list. A click that ends a paint or long press is swallowed, so the
 * pads' own click handlers (tap and keyboard) never double-fire.
 * @param {HTMLElement} root
 * @param {string} selector
 * @param {(intent: import("./gesture").GestureIntent) => void} emit
 * @param {import("./gesture").GestureConfig} [config]
 */
export function bindPadGesture(root, selector, emit, config = DEFAULT_GESTURE) {
  let swallow = false;
  let timer = 0;
  const hit = (x, y) => {
    const doc = root.ownerDocument;
    const el = doc.elementFromPoint?.(x, y);
    const pads = [...root.querySelectorAll(selector)];
    const pad = el ? pads.findIndex((item) => item === el || item.contains(el)) : -1;
    if (pad >= 0) return pad;
    // Gaps map to the nearest pad in the same row band.
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    pads.forEach((item, index) => {
      if (item.hidden) return;
      const box = item.getBoundingClientRect();
      if (y < box.top || y > box.bottom) return;
      const distance = Math.abs(x - (box.left + box.width / 2));
      if (distance < bestDistance && distance <= box.width) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  };
  const gesture = new PadGesture(
    hit,
    (intent) => {
      if (intent.kind === "paint" || intent.kind === "long") swallow = true;
      emit(intent);
    },
    config,
  );
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
  };
  root.addEventListener("pointerdown", (event) => {
    if (event.button > 0) return;
    swallow = false;
    if (!gesture.down(event.pointerId, event.clientX, event.clientY, event.timeStamp)) return;
    clear();
    // event.timeStamp and performance.now() share the page's time origin.
    timer = setTimeout(() => gesture.tick(performance.now()), config.longPressMs);
  });
  root.addEventListener("pointermove", (event) => {
    if (gesture.state === "idle") return;
    gesture.move(event.pointerId, event.clientX, event.clientY, event.timeStamp);
    if (gesture.state !== "pending") clear();
  });
  root.addEventListener("pointerup", (event) => {
    clear();
    gesture.up(event.pointerId, event.clientX, event.clientY, event.timeStamp);
  });
  root.addEventListener("pointercancel", (event) => {
    clear();
    gesture.cancel(event.pointerId);
  });
  root.addEventListener(
    "click",
    (event) => {
      if (!swallow) return;
      swallow = false;
      event.stopPropagation();
      event.preventDefault();
    },
    true,
  );
  root.addEventListener("contextmenu", (event) => event.preventDefault());
  return gesture;
}
