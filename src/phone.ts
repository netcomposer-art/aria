/**
 * My phone (Peter, 2026-11-14; the approved mockups): ARIA reads the motion of the phone the Studio runs on and sends
 * the Studio's instruments Tilt X, Tilt Y, Heading and Shake (nc-situation 0.2.0 `motion`), and a Shake event per
 * shake (`shake`). Its states: off (Allow motion), blocked (the steps to allow it again), live (the meters), paused
 * (the page is hidden), none (a computer: open the Studio on your phone).
 *
 * The maths are nc-situation's (MotionShaper, StillCentre); the sensors, the question and the wake lock are
 * sensors.ts. Settings (Smooth, the centre, Invert, on) are saved with ARIA's (state.ts), so in Scenes.
 */
import {
  MotionShaper,
  type MotionState,
  type MotionValues,
  type SituationMessage,
  StillCentre,
  motionMessage,
  shakeMessage,
} from "@netcomposer/nc-situation";
import { createSwitch } from "@netcomposer/nc-ui";
import { type Attrs, h } from "./dom";
import {
  type Listening,
  type Support,
  isIos,
  listen,
  motionSupport,
  requestMotion,
  wakeLock,
} from "./sensors";
import type { PhoneSettings } from "./state";

export interface PhoneDeps {
  win: Window;
  settings(): PhoneSettings;
  /** Save new settings (ARIA's apply: saved in this browser and the Scene). */
  save(next: PhoneSettings): void;
  send(m: SituationMessage): void;
  sourceId(): string;
  /** The Studio's AudioContext time (s). */
  ctxNow(): number;
  /** Who listens to motion ("Synth, Generator"), null standalone. */
  listeners(): string[] | null;
  /** ARIA is held: nothing is sent. */
  held(): boolean;
  /** The state changed (ARIA resends its status, the module's summary changes). */
  onState(): void;
  help(key: string): Attrs;
  /** The URL players open on their phone. */
  studioUrl: string;
}

/** Shakes shown on the strip (seconds). */
const STRIP_SEC = 10;
/** The Shake meter's ghost: the recent peak, falling away slowly (time constant, s). */
const GHOST_SEC = 1.5;
/** Without a reading this long after listening starts (s), the phone sends nothing: blocked, or no sensor. */
const NO_DATA_SEC = 3;
/** At most one motion message per this long (s). */
const SEND_EVERY = 1 / 60;

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
/** "NE 42°" */
export function headingText(heading01: number): string {
  const deg = Math.round((((heading01 % 1) + 1) % 1) * 360) % 360;
  return `${POINTS[Math.round(deg / 45) % 8]} ${deg}°`;
}
/** "+0.32", "−0.18", "0.00" */
export function signed(v: number): string {
  const r = Math.round(v * 100) / 100;
  if (Math.abs(r) < 0.005) return "0.00";
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}`;
}
/** "invert off", "invert X", "invert Y", "invert X and Y" */
export function invertText(s: { invertX: boolean; invertY: boolean }): string {
  if (s.invertX && s.invertY) return "invert X and Y";
  if (s.invertX) return "invert X";
  if (s.invertY) return "invert Y";
  return "invert off";
}
/** More's summary: "Smooth 30% · centred · invert off". */
export function moreSummary(s: PhoneSettings): string {
  return `Smooth ${Math.round(s.smooth * 100)}% · ${s.centredAt ? "centred" : "not centred"} · ${invertText(s)}`;
}
/** "just now", "2 min ago", "3 h ago", "4 days ago" */
export function ago(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 60) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function createPhone(d: PhoneDeps) {
  const support: Support = motionSupport(d.win);
  const ios = isIos(d.win);
  const shaper = new MotionShaper(d.settings());
  const lock = wakeLock(d.win);
  let listening: Listening | null = null;
  let listenStart = 0;
  let blocked = false;
  let noSensor = support === "none";
  let paused = false;
  let values: MotionValues = shaper.values();
  let ghost = 0;
  let lastT = 0;
  let lastSent = Number.NEGATIVE_INFINITY;
  const shakes: { t: number; s: number }[] = [];
  let centring: StillCentre | null = null;
  let centreNote = "";
  let noDataTimer = 0;

  // ------------------------------------------------------------------------------------------- state

  function state(): MotionState {
    if (noSensor) return "none";
    if (blocked) return "blocked";
    if (!listening) return paused && d.settings().on ? "paused" : "off";
    return paused ? "paused" : "live";
  }
  let lastState = state();
  function changed(): void {
    const s = state();
    lock.set(s === "live");
    if (s !== lastState) {
      lastState = s;
      d.onState();
    }
    paint();
  }

  function onReading(r: Parameters<Parameters<typeof listen>[1]>[0]): void {
    const step = shaper.step(r);
    values = step.values;
    const dt = lastT ? Math.max(0, r.t - lastT) : 0;
    lastT = r.t;
    ghost = Math.max(values.shake, ghost * Math.exp(-dt / GHOST_SEC));
    if (step.shake !== null) {
      shakes.push({ t: r.t, s: step.shake });
      if (!d.held()) d.send(shakeMessage(d.sourceId(), d.ctxNow(), step.shake));
    }
    while (shakes.length && shakes[0]!.t < r.t - STRIP_SEC) shakes.shift();
    if (centring && shaper.angle) {
      centring.step(shaper.angle, r.t);
      if (centring.centre) {
        const centre = centring.centre;
        centring = null;
        d.save({ ...d.settings(), centre, centredAt: Date.now() });
        shaper.set(d.settings());
        centreNote = "";
      } else if (centring.gaveUp) {
        centring = null;
        centreNote = "It kept moving. Rest your hands and try again.";
      }
    }
    if (!d.held() && r.t - lastSent >= SEND_EVERY - 1e-4) {
      lastSent = r.t;
      d.send(motionMessage(d.sourceId(), [{ at: d.ctxNow(), ...values }]));
    }
    schedule();
  }

  function startListening(): void {
    if (listening) return;
    blocked = false;
    listening = listen(d.win, onReading);
    listenStart = d.win.performance.now();
    d.win.clearTimeout(noDataTimer);
    noDataTimer = d.win.setTimeout(() => {
      if (!listening || listening.gotData || paused) return;
      // Nothing came. A phone whose browser blocks motion sends nothing; a computer sends empty readings.
      // Asked and allowed, yet nothing came: no sensor. Never asked (an older phone browser): it blocks motion.
      stopListening();
      if (support === "open") blocked = true;
      else noSensor = true;
      changed();
    }, NO_DATA_SEC * 1000);
    changed();
  }
  function stopListening(): void {
    listening?.stop();
    listening = null;
    centring = null;
    d.win.clearTimeout(noDataTimer);
  }

  /** Allow motion / Try again: called synchronously inside the tap. */
  let asking = false;
  function allowFromTap(): void {
    const answer = requestMotion(d.win);
    asking = true;
    d.save({ ...d.settings(), on: true });
    void answer.then((answer) => {
      asking = false;
      if (answer === "granted") startListening();
      else {
        blocked = answer === "denied";
        changed();
      }
    });
  }
  function turnOff(): void {
    stopListening();
    blocked = false;
    d.save({ ...d.settings(), on: false });
    shaper.reset();
    values = shaper.values();
    ghost = 0;
    shakes.length = 0;
    changed();
  }
  /** A Scene or saved settings with motion on: start without a tap where the browser allows it. */
  function resume(): void {
    if (!d.settings().on || listening || noSensor || paused || asking) return;
    if (support === "open") {
      startListening();
      return;
    }
    void requestMotion(d.win).then((answer) => {
      // "needs-tap": the player taps Allow motion (iOS asks once per visit).
      if (answer === "granted" && d.settings().on) startListening();
      else if (answer === "denied") {
        blocked = true;
        changed();
      }
    });
  }
  function settingsChanged(): void {
    shaper.set(d.settings());
    if (!d.settings().on && listening) turnOff();
    else if (d.settings().on && !listening) resume();
    paint();
  }

  // Pause while the page is hidden (screen locked, another tab or app); back when it shows.
  d.win.document.addEventListener("visibilitychange", () => {
    if (d.win.document.visibilityState === "hidden") {
      if (!listening) return;
      stopListening();
      paused = true;
    } else {
      if (!paused) return;
      paused = false;
      shaper.reset();
      startListening();
      return;
    }
    changed();
  });

  // ------------------------------------------------------------------------------------------- view

  const statusRow = h("div", {
    class: "aria-status",
    role: "status",
    "data-aria": "motion-status",
    ...d.help("motion:status"),
  });
  const toEl = h("span", { class: "aria-small aria-sub aria-mono", "data-aria": "motion-to" });
  const headRow = h("div", { class: "aria-row-between aria-motion-head" }, statusRow, toEl);

  const valueEl = (key: string) =>
    h("span", { class: "aria-mo-val", "data-aria": `motion-${key}` }, "—");
  const field = (
    labelText: string,
    sub: string | null,
    key: string,
    val: HTMLElement,
    ...body: Node[]
  ) =>
    h(
      "div",
      { class: "aria-field" },
      h(
        "div",
        { class: "aria-row-between" },
        h(
          "span",
          {},
          h("span", { class: "nc-label", ...d.help(`motion:${key}`) }, labelText),
          sub ? h("span", { class: "aria-small aria-sub aria-mono aria-mo-sub" }, sub) : null,
        ),
        val,
      ),
      ...body,
    );
  const ends = (...t: (string | HTMLElement)[]) =>
    h(
      "div",
      { class: "aria-row-between aria-small aria-sub aria-mono aria-ends" },
      ...t.map((x) => (typeof x === "string" ? h("span", {}, x) : x)),
    );
  const biMeter = (name: string) => {
    const fill = h("i", {});
    const el = h(
      "div",
      {
        class: "aria-meter aria-mo-meter",
        "data-bi": "",
        role: "meter",
        "aria-label": name,
        "aria-valuemin": "-1",
        "aria-valuemax": "1",
      },
      fill,
    );
    return {
      el,
      set(v: number) {
        const a = 50 + Math.min(0, v) * 50;
        const b = 50 + Math.max(0, v) * 50;
        fill.style.left = `${a}%`;
        fill.style.width = `${b - a}%`;
        el.setAttribute("aria-valuenow", v.toFixed(2));
      },
    };
  };
  const tiltX = biMeter("Tilt X");
  const tiltY = biMeter("Tilt Y");
  const tiltXVal = valueEl("tilt-x");
  const tiltYVal = valueEl("tilt-y");
  const shakeFill = h("i", {});
  const shakeGhost = h("b", {});
  const shakeMeter = h(
    "div",
    {
      class: "aria-meter aria-mo-meter",
      role: "meter",
      "aria-label": "Shake",
      "aria-valuemin": "0",
      "aria-valuemax": "1",
    },
    shakeGhost,
    shakeFill,
  );
  const shakeVal = valueEl("shake");
  const shakeCount = h("span", { "data-aria": "motion-shakes" }, "no shakes");
  const strip = h("canvas", { class: "aria-mo-strip", "data-aria": "motion-strip" });
  const tape = h("canvas", { class: "aria-mo-tape", "data-aria": "motion-tape" });
  const headingVal = valueEl("heading");
  const live = h(
    "div",
    { class: "aria-body aria-mo-live", "data-aria": "motion-live" },
    field("Tilt X", null, "tilt-x", tiltXVal, tiltX.el, ends("left", "0", "right")),
    field("Tilt Y", null, "tilt-y", tiltYVal, tiltY.el, ends("back", "0", "forward")),
    field("Shake", null, "shake", shakeVal, shakeMeter, strip, ends("−10 s", shakeCount, "now")),
    field("Heading", "slow", "heading", headingVal, tape),
  );

  const button = (text: string, key: string, run: () => void) => {
    const b = h(
      "button",
      {
        type: "button",
        class: "nc-btn aria-mo-btn",
        "data-aria-action": key,
        ...d.help(`motion:${key}`),
      },
      text,
    );
    b.addEventListener("click", run);
    return b;
  };
  const text = (t: string) => h("p", { class: "aria-mo-text" }, t);
  const small = (t: string, key?: string) =>
    h("p", { class: "aria-small aria-sub aria-mono", ...(key ? { "data-aria": key } : {}) }, t);
  const names = (title: string) =>
    h(
      "div",
      { class: "aria-field" },
      h("span", { class: "nc-label" }, title),
      h(
        "div",
        { class: "aria-mo-names" },
        ...["Tilt X", "Tilt Y", "Shake", "Heading"].map((n) =>
          h("span", {}, h("span", {}, n), h("span", { class: "aria-mono" }, "—")),
        ),
      ),
    );

  const allow = h(
    "div",
    { class: "aria-body", "data-aria": "motion-allow" },
    text("Tilt and shake this phone to move sounds in the Studio."),
    button("Allow motion", "allow-motion", allowFromTap),
    small("Your phone asks once. Nothing leaves this phone."),
    names("Signals it gives"),
  );
  const steps = h("ol", { class: "aria-mo-steps", "data-aria": "motion-steps" });
  const blockedEl = h(
    "div",
    { class: "aria-body", "data-aria": "motion-blocked" },
    text("Motion is blocked for this site, so ARIA can't read the phone."),
    h("div", { class: "aria-field" }, h("span", { class: "nc-label" }, "To allow it"), steps),
    button("Try again", "allow-motion", allowFromTap),
    small(
      ios
        ? "Safari remembers No until it is closed. Your Studio and saves stay as they are."
        : "Your Studio and saves stay as they are.",
    ),
  );
  const stepTexts = ios
    ? [
        "Close Safari fully: swipe up from the bottom edge, pause, then swipe Safari away.",
        `Open ${d.studioUrl} again.`,
        "Tap Allow motion, then Allow.",
      ]
    : [
        "Open this site's settings in your browser (the icon left of the address).",
        "Set Motion sensors to Allow.",
        "Come back and tap Try again.",
      ];
  steps.append(...stepTexts.map((t) => h("li", {}, t)));
  const none = h(
    "div",
    { class: "aria-body", "data-aria": "motion-none" },
    text("Open the Studio on your phone to use its motion."),
    small(`This computer has no motion sensor. On your phone: ${d.studioUrl}`),
    names("Signals it gives"),
  );
  const pausedNote = small(
    "Paused while this page is hidden. It resumes when the page is back.",
    "motion-paused",
  );

  /** The module's main mount. */
  const body = h(
    "div",
    { class: "aria-body", "data-aria-module": "phone" },
    headRow,
    live,
    pausedNote,
    allow,
    blockedEl,
    none,
  );

  // --- More (inside the kit group, under its Smooth slider)
  const holdBtn = button("Hold still to centre", "centre", () => {
    if (!listening) return;
    centring = new StillCentre();
    centreNote = "";
    paint();
  });
  const centreEl = small("", "motion-centre");
  const invert = (axis: "X" | "Y") => {
    const sw = createSwitch({
      checked: d.settings()[`invert${axis}`],
      label: `Invert Tilt ${axis}`,
      onChange: (on) => d.save({ ...d.settings(), [`invert${axis}`]: on }),
    });
    sw.el.dataset.aria = `motion-invert-${axis.toLowerCase()}`;
    const row = h(
      "div",
      { class: "aria-mo-row", ...d.help("motion:invert") },
      h("span", { class: "nc-label" }, `Invert Tilt ${axis}`),
      sw.el,
    );
    return { row, sw };
  };
  const invX = invert("X");
  const invY = invert("Y");
  const offBtn = h(
    "button",
    {
      type: "button",
      class: "nc-page-action aria-mo-off",
      "data-aria-action": "motion-off",
      ...d.help("motion:off"),
    },
    "Turn motion off",
  );
  offBtn.addEventListener("click", turnOff);
  const more = h(
    "div",
    { class: "aria-body aria-mo-more" },
    h("div", { class: "aria-field" }, holdBtn, centreEl),
    invX.row,
    invY.row,
    offBtn,
  );

  const foot = small(
    lock.supported
      ? "Screen stays on while motion is live."
      : "This browser can't keep the screen on: it may sleep while you play.",
    "motion-foot",
  );

  function paintStatus(s: MotionState): void {
    const word = {
      off: "OFF",
      blocked: "BLOCKED",
      live: "LIVE",
      paused: "PAUSED",
      none: "NO SENSOR",
    }[s];
    const cls = s === "live" ? "aria-live" : s === "paused" ? "aria-quiet" : "aria-off";
    const parts: (Node | string)[] = [
      h(
        "span",
        { class: `aria-word ${cls}`, "data-state": s },
        h("i", { class: "aria-dot" }),
        word,
      ),
    ];
    if (s === "live")
      parts.push(
        h(
          "span",
          { class: "aria-sub", "data-aria": "motion-rate" },
          `${listening?.rate() ?? 0} readings/s`,
        ),
      );
    statusRow.replaceChildren(...parts);
    const who = d.listeners();
    toEl.textContent =
      s !== "live" && s !== "paused"
        ? ""
        : who === null
          ? "standalone"
          : who.length
            ? `to ${who.join(", ")}`
            : "no listeners yet";
  }

  /** Repaint the state, the meters and More. */
  function paint(): void {
    const s = state();
    body.dataset.motionState = s;
    paintStatus(s);
    live.hidden = s !== "live" && s !== "paused";
    pausedNote.hidden = s !== "paused";
    allow.hidden = s !== "off";
    blockedEl.hidden = s !== "blocked";
    none.hidden = s !== "none";
    foot.hidden = s !== "live" && s !== "paused";
    paintValues();
    const st = d.settings();
    invX.sw.set(st.invertX);
    invY.sw.set(st.invertY);
    const remaining = centring ? Math.max(1, Math.ceil(centring.remaining(lastT))) : 0;
    holdBtn.textContent = centring ? `Hold still… ${remaining}` : "Hold still to centre";
    holdBtn.toggleAttribute("data-holding", !!centring);
    centreEl.textContent = centring
      ? `Keep it still. Centring in ${remaining} s.`
      : centreNote ||
        (st.centredAt
          ? `Centred ${ago(Date.now() - st.centredAt)}, at the angle you held then.`
          : "Not centred yet: 0 is a phone held at a reading angle.");
  }
  function paintValues(): void {
    tiltX.set(values.tiltX);
    tiltY.set(values.tiltY);
    tiltXVal.textContent = signed(values.tiltX);
    tiltYVal.textContent = signed(values.tiltY);
    shakeVal.textContent = values.shake.toFixed(2);
    shakeFill.style.width = `${Math.round(values.shake * 1000) / 10}%`;
    shakeGhost.style.width = `${Math.round(ghost * 1000) / 10}%`;
    shakeMeter.setAttribute("aria-valuenow", values.shake.toFixed(2));
    headingVal.textContent = lastT ? headingText(values.heading) : "—";
    const n = shakes.length;
    shakeCount.textContent = n ? `${n} shake${n === 1 ? "" : "s"}` : "no shakes";
    const rate = statusRow.querySelector('[data-aria="motion-rate"]');
    if (rate) rate.textContent = `${listening?.rate() ?? 0} readings/s`;
    draw();
  }

  // --- canvases (drawn only on screen)
  const css = (name: string) => getComputedStyle(body).getPropertyValue(name).trim();
  function prep(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
    if (d.win.document.visibilityState === "hidden") return null;
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const dpr = d.win.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const hh = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== hh) {
      c.width = w;
      c.height = hh;
    }
    const g = c.getContext("2d");
    g?.clearRect(0, 0, w, hh);
    return g;
  }
  function draw(): void {
    const dpr = d.win.devicePixelRatio || 1;
    const g = prep(strip);
    if (g) {
      const { width: w, height: hh } = strip;
      g.fillStyle = css("--nc-ui-divider");
      g.fillRect(0, Math.round(hh / 2), w, Math.max(1, Math.round(dpr / 2)));
      g.fillStyle = css("--aria-magma");
      for (const e of shakes) {
        const age = Math.max(0, lastT - e.t);
        const x = (1 - age / STRIP_SEC) * w;
        const bh = Math.max(4 * dpr, e.s * (hh - 6 * dpr));
        g.globalAlpha = 0.35 + 0.65 * (1 - age / STRIP_SEC);
        g.fillRect(
          Math.round(x - dpr),
          Math.round((hh - bh) / 2),
          Math.round(2 * dpr),
          Math.round(bh),
        );
      }
      g.globalAlpha = 1;
    }
    const t = prep(tape);
    if (t && lastT) {
      const { width: w, height: hh } = tape;
      const heading = values.heading * 360;
      const span = 180;
      const per = w / span;
      t.fillStyle = css("--nc-ui-text-sub");
      t.font = `${10 * dpr}px ${css("--nc-ui-font-readout") || "monospace"}`;
      t.textAlign = "center";
      t.textBaseline = "top";
      for (let deg = Math.floor((heading - 90) / 15) * 15; deg <= heading + 90; deg += 15) {
        const x = w / 2 + (deg - heading) * per;
        if (x < 0 || x > w) continue;
        const n = ((deg % 360) + 360) % 360;
        const major = n % 45 === 0;
        const th = (major ? 12 : 6) * dpr;
        t.fillRect(Math.round(x), hh - th, Math.max(1, Math.round(dpr)), th);
        if (major && x > 14 * dpr && x < w - 14 * dpr) t.fillText(POINTS[n / 45]!, x, 3 * dpr);
      }
      t.fillStyle = css("--aria-magma");
      t.fillRect(Math.round(w / 2 - dpr), 18 * dpr, Math.round(2 * dpr), hh - 18 * dpr);
    }
  }
  let frame = 0;
  function schedule(): void {
    if (frame) return;
    frame = d.win.requestAnimationFrame(() => {
      frame = 0;
      paint();
    });
    // A frame that isn't drawn (a hidden tab's frame) still updates its words now and then.
    d.win.setTimeout(() => {
      if (frame) {
        d.win.cancelAnimationFrame(frame);
        frame = 0;
        paintValues();
      }
    }, 250);
  }

  return {
    state,
    body,
    more,
    foot,
    paint,
    settingsChanged,
    resume,
    /** For tests (the Studio's e2e reads it). */
    debug: () => ({
      state: state(),
      values,
      support,
      shakes: shakes.length,
      listenStart,
      wake: lock.held,
    }),
  };
}
