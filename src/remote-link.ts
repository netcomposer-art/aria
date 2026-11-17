/**
 * The phone remote's connection (Peter, 2026-11-17: the iPhone's motion modulating the Studio on a computer). Both
 * ends use it: ARIA in the Studio (role "studio") and the phone's Remote page (role "phone"). It talks to the relay
 * (relay/, a Cloudflare Worker), reconnects after a network blip, and measures the delay between the two.
 *
 * Messages (JSON, each with `k`): "m" a motion reading, "s" a Shake, "ping"/"pong" the delay, "hi" the names,
 * "vis" the phone page shown or hidden, "hold" the phone's Hold, "end". The relay adds "hello", "peer", "gone",
 * "refused".
 */
import type { MotionReading } from "@netcomposer/nc-situation";
import {
  CLOSE,
  type Role,
  cleanName,
  formatCode,
  normalizeCode,
  randomCode,
} from "../relay/src/room";

export { CLOSE, formatCode, normalizeCode, randomCode };

/** The deployed relay. A page can be pointed elsewhere for tests: localStorage "nc-remote-relay" or ?relay=. */
export const DEFAULT_RELAY = "wss://nc-remote.psemme.workers.dev";

export function relayUrl(win: Window): string {
  try {
    const q = new URL(win.location.href).searchParams.get("relay");
    if (q && /^wss?:\/\//.test(q)) return q.replace(/\/$/, "");
  } catch {
    /* no URL */
  }
  try {
    const v = win.localStorage.getItem("nc-remote-relay");
    if (v && /^wss?:\/\//.test(v)) return v.replace(/\/$/, "");
  } catch {
    /* storage blocked */
  }
  return DEFAULT_RELAY;
}

/** This tab's token (kept for the tab, so a reload or a reconnect replaces its own old socket). */
export function tabToken(win: Window, key: string): string {
  try {
    const old = win.sessionStorage.getItem(key);
    if (old && /^[A-Za-z0-9_-]{8,40}$/.test(old)) return old;
  } catch {
    /* storage blocked */
  }
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const t = Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 20);
  try {
    win.sessionStorage.setItem(key, t);
  } catch {
    /* storage blocked */
  }
  return t;
}

/** The link the phone opens: …/remote/#K74Q (the Remote page reads the code from the hash). */
export function pairLink(origin: string, code: string): string {
  return `${origin}/remote/#${code}`;
}

// ------------------------------------------------------------------------------------------- readings on the wire

const r2 = (x: number | null | undefined, d = 2) =>
  typeof x === "number" && Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null;
const vec = (v: MotionReading["accel"]) => (v ? [r2(v.x), r2(v.y), r2(v.z)] : null);

/** A reading as a message: about 120 bytes. `t` stays the phone's own time (s). */
export function packReading(r: MotionReading, tap = false): string {
  return JSON.stringify({
    k: "m",
    t: r2(r.t, 4),
    b: r2(r.beta),
    g: r2(r.gamma),
    h: r2(r.heading, 1),
    a: vec(r.accel),
    ag: vec(r.accelG),
    sa: r.screenAngle ?? 0,
    ...(tap ? { tap: 1 } : {}),
  });
}

const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const unvec = (v: unknown) =>
  Array.isArray(v) && v.length === 3 && v.every(num) ? { x: v[0], y: v[1], z: v[2] } : null;

/** A message back to a reading (null when it isn't one). */
export function unpackReading(
  m: Record<string, unknown>,
): (MotionReading & { tap: boolean }) | null {
  if (m.k !== "m" || !num(m.t)) return null;
  return {
    t: m.t,
    beta: num(m.b) ? m.b : null,
    gamma: num(m.g) ? m.g : null,
    heading: num(m.h) ? m.h : null,
    accel: unvec(m.a),
    accelG: unvec(m.ag),
    screenAngle: num(m.sa) ? m.sa : 0,
    tap: m.tap === 1,
  };
}

/** Tap = Shake: a reading carrying a jolt past the Shake threshold, so the Studio hears exactly a shake. */
export const TAP_JOLT_MS2 = 16;

// ------------------------------------------------------------------------------------------- delay

/**
 * The delay between the two ends: the Studio pings, the phone answers with its own clock. Delay is half the round
 * trip (median of the last 9); the clock offset lets each reading's transit be worked out, and jitter is the spread
 * of those transits (mean absolute deviation over the last 2 s).
 */
export class Delay {
  private rtts: number[] = [];
  /** Phone clock minus Studio clock (ms), from the latest pong. */
  offset: number | null = null;
  private transits: { at: number; v: number }[] = [];
  pong(t0: number, tp: number, now: number): void {
    const rtt = Math.max(0, now - t0);
    this.rtts.push(rtt);
    if (this.rtts.length > 9) this.rtts.shift();
    // The phone answered half a round trip after the ping left.
    this.offset = tp - (t0 + rtt / 2);
  }
  /** Delay one way (ms), or null before the first pong. */
  get ms(): number | null {
    if (!this.rtts.length) return null;
    const s = [...this.rtts].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]! / 2;
  }
  /** A reading sent at phone time `tPhoneMs` arrived now (Studio ms). */
  reading(tPhoneMs: number, now: number): void {
    if (this.offset === null) return;
    this.transits.push({ at: now, v: now - (tPhoneMs - this.offset) });
    while (this.transits.length && this.transits[0]!.at < now - 2000) this.transits.shift();
  }
  /** Jitter (ms): how much the transit time wanders, or null. */
  get jitter(): number | null {
    const n = this.transits.length;
    if (n < 5) return null;
    const mean = this.transits.reduce((s, x) => s + x.v, 0) / n;
    return this.transits.reduce((s, x) => s + Math.abs(x.v - mean), 0) / n;
  }
  reset(): void {
    this.rtts = [];
    this.offset = null;
    this.transits = [];
  }
}

/** "38 ms", "38 ms ± 6" */
export function delayText(ms: number | null, jitter: number | null = null): string {
  if (ms === null) return "measuring…";
  const d = `${Math.round(ms)} ms`;
  return jitter === null ? d : `${d} ± ${Math.round(jitter)}`;
}

// ------------------------------------------------------------------------------------------- the socket

export type LinkState =
  | "connecting"
  | "waiting" // in the room, the other side not there
  | "paired"
  | "refused"
  | "ended"
  | "offline"; // lost the relay; trying again

export interface LinkOptions {
  win: Window;
  relay: string;
  code: string;
  role: Role;
  token: string;
  name: () => string;
  onMessage(m: Record<string, unknown>): void;
  onState(s: LinkState, detail: { peer: string | null; text?: string; why?: string }): void;
  /** WebSocket constructor (tests). */
  WS?: typeof WebSocket;
}

/** Backoff between reconnects (s), capped. */
const BACKOFF = [0.5, 1, 2, 4, 8];

export function connect(o: LinkOptions) {
  const WS = o.WS ?? (o.win as Window & { WebSocket: typeof WebSocket }).WebSocket;
  let ws: WebSocket | null = null;
  let state: LinkState = "connecting";
  let peer: string | null = null;
  let tries = 0;
  let timer = 0;
  let stopped = false;
  const set = (s: LinkState, extra: { text?: string; why?: string } = {}) => {
    state = s;
    o.onState(s, { peer, ...extra });
  };
  function open(): void {
    if (stopped) return;
    const q = new URLSearchParams({ role: o.role, token: o.token, name: cleanName(o.name(), "") });
    const sock = new WS(`${o.relay}/room/${o.code}?${q}`);
    ws = sock;
    let refusal: { why: string; text: string } | null = null;
    sock.onopen = () => {
      tries = 0;
    };
    sock.onmessage = (ev: MessageEvent) => {
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m.k === "hello") {
        peer = typeof m.peer === "string" ? m.peer : null;
        set(peer ? "paired" : "waiting");
        send({ k: "hi", name: o.name() });
      } else if (m.k === "peer") {
        peer = typeof m.name === "string" ? m.name : "";
        set("paired");
        send({ k: "hi", name: o.name() });
      } else if (m.k === "gone") {
        peer = null;
        set("waiting");
      } else if (m.k === "refused") {
        refusal = { why: String(m.why), text: String(m.text ?? "") };
      } else if (m.k === "hi") {
        if (typeof m.name === "string" && m.name) {
          peer = m.name;
          if (state === "paired") o.onState(state, { peer });
        }
        o.onMessage(m);
      } else o.onMessage(m);
    };
    sock.onclose = (ev: CloseEvent) => {
      if (ws !== sock) return;
      ws = null;
      peer = null;
      if (stopped) return;
      if (refusal || ev.code === CLOSE.refused) {
        set("refused", refusal ?? { why: ev.reason, text: "" });
        return;
      }
      if (ev.code === CLOSE.ended) {
        set("ended");
        return;
      }
      if (ev.code === CLOSE.replaced) {
        // This tab opened another socket (a reload elsewhere in the tab); that one carries on.
        set("ended", { text: "Paired again from another page." });
        return;
      }
      set("offline");
      const wait = BACKOFF[Math.min(tries, BACKOFF.length - 1)]!;
      tries++;
      timer = o.win.setTimeout(open, wait * 1000);
    };
  }
  function send(m: Record<string, unknown> | string): boolean {
    if (!ws || ws.readyState !== 1) return false;
    ws.send(typeof m === "string" ? m : JSON.stringify(m));
    return true;
  }
  open();
  return {
    send,
    get state() {
      return state;
    },
    get peer() {
      return peer;
    },
    /** Socket buffered bytes (the phone skips readings while the network is behind). */
    get buffered() {
      return ws?.bufferedAmount ?? 0;
    },
    /** End the pairing for both sides. */
    end(): void {
      send({ k: "end" });
      stop();
      set("ended");
    },
    /** Close this side only (the page goes away); the other side hears "gone". */
    stop,
    /** Try now (after a network change). */
    retry(): void {
      if (ws || stopped) return;
      o.win.clearTimeout(timer);
      tries = 0;
      open();
    },
  };
  function stop(): void {
    stopped = true;
    o.win.clearTimeout(timer);
    const s = ws;
    ws = null;
    try {
      s?.close(1000, "bye");
    } catch {
      /* closed */
    }
  }
}
export type Link = ReturnType<typeof connect>;
