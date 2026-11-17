/**
 * ARIA Remote (Peter, 2026-11-17; the approved mockup): the page a phone opens to send its motion to the Studio on a
 * computer. netcomposer.art/remote/#K74Q (the QR in ARIA) or netcomposer.art/remote and type the code. No sound.
 *
 * It reads the sensors (sensors.ts, as ARIA's My phone does), sends each reading to the Studio through the relay
 * (remote-link.ts), where ARIA shapes it exactly as it shapes its own phone's motion. Tap = Shake sends a reading with
 * a jolt past the Shake threshold, so the Studio hears it as a shake. Hold stops sending; End ends the pairing.
 */
import { type MotionReading, MotionShaper } from "@netcomposer/nc-situation";
import { h } from "./dom";
import {
  type Link,
  type LinkState,
  TAP_JOLT_MS2,
  connect,
  delayText,
  formatCode,
  normalizeCode,
  packReading,
  relayUrl,
  tabToken,
} from "./remote-link";
import { type Listening, isIos, listen, motionSupport, requestMotion, wakeLock } from "./sensors";

const win = window;
const app = document.getElementById("app")!;
/** At most one reading per this long (ms): about 60 a second. */
const SEND_MS = 1000 / 60;
/** Skip readings while the socket is this far behind (bytes): a slow network gets fresh readings, not old ones. */
const BEHIND_BYTES = 4096;

const support = motionSupport(win);
const ios = isIos(win);
const lock = wakeLock(win);
const preview = new MotionShaper();

function deviceName(): string {
  const ua = win.navigator.userAgent;
  if (
    /iPad/.test(ua) ||
    (win.navigator.platform === "MacIntel" && win.navigator.maxTouchPoints > 1)
  )
    return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  return "Phone";
}

let code: string | null = normalizeCode(win.location.hash.slice(1));
let link: Link | null = null;
let linkState: LinkState | "idle" = "idle";
let linkText = "";
let studio = "";
let delayMs: number | null = null;
let jitterMs: number | null = null;
let listening: Listening | null = null;
let motion: "ask" | "asking" | "live" | "blocked" | "none" = "ask";
let held = false;
let lastSent = 0;
let lastReading: MotionReading | null = null;
let tilt = { x: 0, y: 0 };
let shakeFlash = 0;

// ------------------------------------------------------------------------------------------- the views

const word = h("span", { class: "rm-word", "data-remote": "state" });
const sub = h("p", { class: "rm-sub", "data-remote": "to" });
const note = h("p", { class: "rm-sub", "data-remote": "note" });
const head = h(
  "header",
  { class: "rm-head" },
  h("span", { class: "rm-title" }, h("b", {}, "ARIA"), h("span", {}, "REMOTE")),
);

// Enter the code
const codeInput = h("input", {
  class: "rm-code-input",
  "data-remote": "code-input",
  inputmode: "text",
  autocapitalize: "characters",
  autocomplete: "off",
  spellcheck: "false",
  maxlength: "6",
  placeholder: "K7 4Q",
  "aria-label": "Pairing code",
});
const codeErr = h("p", { class: "rm-sub rm-err", "data-remote": "code-error" });
const pairBtn = h(
  "button",
  { type: "button", class: "rm-btn rm-primary", "data-remote": "pair" },
  "Pair",
);
const enterEl = h(
  "section",
  { class: "rm-panel", "data-remote": "enter" },
  h(
    "p",
    { class: "rm-text" },
    "Type the code shown in ARIA on the computer (My phone → A phone with this Studio).",
  ),
  codeInput,
  codeErr,
  pairBtn,
);

// Allow motion
const allowBtn = h(
  "button",
  { type: "button", class: "rm-btn rm-primary", "data-remote": "allow" },
  "Allow motion",
);
const allowEl = h(
  "section",
  { class: "rm-panel", "data-remote": "allow-panel" },
  h(
    "p",
    { class: "rm-text" },
    "Paired. Allow motion so tilting and shaking this phone moves sounds in the Studio.",
  ),
  allowBtn,
  h(
    "p",
    { class: "rm-sub" },
    "Your phone asks once. Only its motion goes to the Studio; nothing is stored.",
  ),
);
const blockedEl = h(
  "section",
  { class: "rm-panel", "data-remote": "blocked" },
  h("p", { class: "rm-text" }, "Motion is blocked for this site."),
  h(
    "ol",
    { class: "rm-steps" },
    ...(ios
      ? [
          "Close Safari fully: swipe up from the bottom edge, pause, then swipe Safari away.",
          "Open the pairing link again (scan the code in ARIA).",
          "Tap Allow motion, then Allow.",
        ]
      : [
          "Open this site's settings in your browser (the icon left of the address).",
          "Set Motion sensors to Allow.",
          "Come back and tap Allow motion.",
        ]
    ).map((t) => h("li", {}, t)),
  ),
);
const noneEl = h(
  "section",
  { class: "rm-panel", "data-remote": "none" },
  h("p", { class: "rm-text" }, "This device has no motion sensor. Open this page on your phone."),
);

// Live: the tilt pad, Tap = Shake, Hold and End
const dot = h("i", { class: "rm-pad-dot" });
const pad = h("div", { class: "rm-pad", "data-remote": "pad", "aria-hidden": "true" }, dot);
const tapBtn = h(
  "button",
  { type: "button", class: "rm-btn rm-tap", "data-remote": "tap" },
  "TAP = SHAKE",
);
const holdBtn = h("button", { type: "button", class: "rm-link", "data-remote": "hold" }, "Hold");
const endBtn = h("button", { type: "button", class: "rm-link", "data-remote": "end" }, "End");
const liveEl = h("section", { class: "rm-live", "data-remote": "live" }, pad, tapBtn);
const foot = h("footer", { class: "rm-foot" }, holdBtn, endBtn);

// Ended / refused / lost
const againBtn = h(
  "button",
  { type: "button", class: "rm-btn", "data-remote": "again" },
  "Pair again",
);
const doneText = h("p", { class: "rm-text", "data-remote": "done-text" });
const doneEl = h("section", { class: "rm-panel", "data-remote": "done" }, doneText, againBtn);

app.append(
  head,
  h("div", { class: "rm-status" }, h("i", { class: "rm-dot" }), word),
  sub,
  note,
  enterEl,
  allowEl,
  blockedEl,
  noneEl,
  liveEl,
  doneEl,
  foot,
);

// ------------------------------------------------------------------------------------------- behaviour

function paired(): boolean {
  return linkState === "paired";
}

function paint(): void {
  const st = !code
    ? "enter"
    : linkState === "refused" || linkState === "ended"
      ? "done"
      : !paired()
        ? "connecting"
        : motion === "live"
          ? held
            ? "held"
            : "live"
          : motion;
  document.body.dataset.state = st;
  const text: Record<string, string> = {
    enter: "Pair",
    connecting:
      linkState === "offline" ? "Reconnecting" : linkState === "waiting" ? "Waiting" : "Connecting",
    ask: "Paired",
    asking: "Paired",
    blocked: "Blocked",
    none: "No sensor",
    live: "Live",
    held: "Held",
    done: linkState === "refused" ? "Not paired" : "Ended",
  };
  word.textContent = text[st] ?? "";
  document.body.dataset.live = st === "live" ? "1" : "";
  sub.textContent = paired()
    ? `${st === "live" ? "Sending motion to" : "Paired with"} “${studio || "the Studio"}” · ${delayText(delayMs, jitterMs)}`
    : code && linkState !== "refused" && linkState !== "ended"
      ? `Code ${formatCode(code)}`
      : "";
  note.textContent =
    st === "live"
      ? lock.supported
        ? "Keep this page open; the screen stays awake."
        : "Keep this page open and the screen on."
      : st === "held"
        ? "Held: the Studio keeps the last motion until you tap Hold again."
        : linkState === "waiting"
          ? "The Studio isn't there right now. Waiting for it…"
          : linkState === "offline"
            ? "Lost the connection. Trying again…"
            : "";
  enterEl.hidden = st !== "enter";
  allowEl.hidden = !(st === "ask" || st === "asking");
  allowBtn.toggleAttribute("disabled", st === "asking");
  blockedEl.hidden = st !== "blocked";
  noneEl.hidden = st !== "none";
  liveEl.hidden = !(st === "live" || st === "held");
  foot.hidden = !paired() && linkState !== "waiting" && linkState !== "offline";
  holdBtn.textContent = held ? "Release" : "Hold";
  holdBtn.toggleAttribute("disabled", !(st === "live" || st === "held"));
  doneEl.hidden = st !== "done";
  doneText.textContent =
    linkState === "refused"
      ? linkText || "Not paired."
      : linkText || "Pairing ended. The Studio holds the last motion.";
  lock.set(st === "live" || st === "held");
  dot.style.left = `${50 + tilt.x * 45}%`;
  dot.style.top = `${50 - tilt.y * 45}%`;
  tapBtn.toggleAttribute("data-flash", win.performance.now() - shakeFlash < 180);
}

function send(r: MotionReading, tap = false): void {
  if (!link || !paired() || held || document.visibilityState !== "visible") return;
  if (!tap && link.buffered > BEHIND_BYTES) return;
  link.send(packReading(r, tap));
}

function onReading(r: MotionReading): void {
  lastReading = r;
  const v = preview.step(r).values;
  tilt = { x: v.tiltX, y: v.tiltY };
  const now = win.performance.now();
  if (now - lastSent >= SEND_MS - 0.5) {
    lastSent = now;
    send(r);
  }
  schedule();
}

let frame = 0;
function schedule(): void {
  if (frame) return;
  frame = win.requestAnimationFrame(() => {
    frame = 0;
    paint();
  });
}

function startListening(): void {
  if (listening) return;
  listening = listen(win, onReading);
  motion = "live";
  paint();
}
function stopListening(): void {
  listening?.stop();
  listening = null;
}

function allowFromTap(): void {
  if (support === "none") {
    motion = "none";
    paint();
    return;
  }
  const answer = requestMotion(win); // inside the tap (iOS)
  motion = "asking";
  paint();
  void answer.then((a) => {
    if (a === "granted") startListening();
    else {
      motion = a === "denied" ? "blocked" : "ask";
      paint();
    }
  });
}

function tap(): void {
  const t = win.performance.now() / 1000;
  const base: MotionReading = lastReading ?? {
    t,
    beta: null,
    gamma: null,
    heading: null,
    accel: null,
    accelG: null,
    screenAngle: 0,
  };
  send({ ...base, t, accel: { x: 0, y: 0, z: TAP_JOLT_MS2 } }, true);
  shakeFlash = win.performance.now();
  paint();
  win.setTimeout(paint, 200);
  try {
    win.navigator.vibrate?.(30);
  } catch {
    /* no vibration */
  }
}

function pair(next: string): void {
  code = next;
  if (win.location.hash.slice(1) !== next) win.history.replaceState(null, "", `#${next}`);
  link?.stop();
  linkState = "connecting";
  linkText = "";
  studio = "";
  delayMs = jitterMs = null;
  link = connect({
    win,
    relay: relayUrl(win),
    code: next,
    role: "phone",
    token: tabToken(win, "aria-remote-phone-token"),
    name: deviceName,
    onMessage: (m) => {
      if (m.k === "ping" && typeof m.t0 === "number") {
        link?.send({ k: "pong", t0: m.t0, tp: win.performance.now() });
        delayMs = typeof m.d === "number" ? m.d : null;
        jitterMs = typeof m.j === "number" ? m.j : null;
        schedule();
      } else if (m.k === "hi" && typeof m.name === "string") {
        studio = m.name;
        paint();
      }
    },
    onState: (st, info) => {
      linkState = st;
      linkText = info.text ?? "";
      if (st === "paired") {
        if (info.peer) studio = info.peer;
        link?.send({ k: "vis", v: document.visibilityState });
        if (held) link?.send({ k: "hold", on: true });
        // Android and others that don't ask: start reading straight away.
        if (motion === "ask" && support === "open") startListening();
        if (motion === "ask" && support === "none") motion = "none";
      }
      if (st === "ended" || st === "refused") {
        stopListening();
        if (motion === "live") motion = "ask";
        held = false;
      }
      paint();
    },
  });
  paint();
}

pairBtn.addEventListener("click", () => {
  const c = normalizeCode(codeInput.value);
  if (!c) {
    codeErr.textContent = "Four letters and numbers, like K7 4Q.";
    return;
  }
  codeErr.textContent = "";
  pair(c);
});
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") pairBtn.click();
});
allowBtn.addEventListener("click", allowFromTap);
tapBtn.addEventListener("click", tap);
holdBtn.addEventListener("click", () => {
  held = !held;
  link?.send({ k: "hold", on: held });
  paint();
});
endBtn.addEventListener("click", () => {
  link?.end();
  stopListening();
  linkText = "Pairing ended. The Studio holds the last motion.";
  motion = "ask";
  held = false;
  paint();
});
againBtn.addEventListener("click", () => {
  link?.stop();
  link = null;
  linkState = "idle";
  code = null;
  win.history.replaceState(null, "", win.location.pathname + win.location.search);
  paint();
  codeInput.focus();
});
win.addEventListener("hashchange", () => {
  const c = normalizeCode(win.location.hash.slice(1));
  if (c && c !== code) pair(c);
});
document.addEventListener("visibilitychange", () => {
  const v = document.visibilityState;
  link?.send({ k: "vis", v });
  if (v === "hidden") {
    if (listening) {
      stopListening();
      motion = "live"; // comes back on its own: iOS doesn't ask again within the visit
    }
  } else {
    preview.reset();
    if (motion === "live" && paired()) startListening();
    link?.retry();
  }
  paint();
});
win.addEventListener("online", () => link?.retry());

if (code) pair(code);
paint();

/** For tests. */
(win as Window & { __ARIA_REMOTE__?: unknown }).__ARIA_REMOTE__ = () => ({
  code,
  link: linkState,
  motion,
  held,
  studio,
  delay: delayMs,
  state: document.body.dataset.state,
});
