/**
 * The Situation contract (v1): how ARIA, the Studio's Situation module, hands its signals to instruments through the
 * Studio, the same way for every module.
 *
 *  - Times (`at`) are AudioContext seconds on the Studio's one context. That context runs whether the transport plays
 *    or not, so a signal means the same thing playing or stopped (Peter's rule: sound-shaping works without Play).
 *  - `energy`: a continuous 0–1 level of how much the ground (the world) is moving, as frames sent a little ahead.
 *  - `table`: one prepared wavetable cycle (the Ground table), `TABLE_SIZE` samples in −1..1, for one Speed lane.
 *  - `status`: where the source is (live, quiet, offline, off), what station, how far behind real time, the credit.
 *  - `off`: the source went away or is held; receivers glide Energy to rest and keep their last table.
 *  - `motion` (0.2.0, My phone): the phone's Tilt X, Tilt Y (−1..1, 0 centred), Heading (0..1, slow) and Shake
 *    (0..1, a level that falls away), as frames.
 *  - `shake` (0.2.0): a Shake event, a trigger (CALLIOPE's New phrase).
 *  - `status.motion` (0.2.0, optional): where My phone is (off, blocked, live, paused, none).
 *
 * Messages are plain objects (structured-clonable). A receiver checks every message with parseSituationMessage(),
 * which copies it into fresh objects, so nothing from another frame is kept by reference. Unknown kinds are ignored
 * (null), so later kinds (motion and shake came in 0.2.0; harmony may follow) are additive; a newer major version is
 * ignored too.
 */

/** The contract's version. A receiver ignores messages from a newer major version. */
export const SITUATION_VERSION = 1;

/** Samples in one Ground table cycle. */
export const TABLE_SIZE = 1024;
/** The Speed lanes a receiver can ask for: real time, or faster through the stored ground motion. */
export const TABLE_SPEEDS = [1, 10, 100] as const;
export type TableSpeed = (typeof TABLE_SPEEDS)[number];
/** The most Energy frames one message may carry. */
export const MAX_ENERGY_FRAMES = 32;
/** The most motion frames one message may carry. */
export const MAX_MOTION_FRAMES = 32;
/** The longest source id, name or credit, in characters. */
export const MAX_ID_LENGTH = 128;
export const MAX_CREDIT_LENGTH = 400;

/** A seismometer channel: FDSN network, station, location and channel codes, a place name and samples per second. */
export interface Station {
  net: string;
  sta: string;
  loc: string;
  cha: string;
  /** What the player sees ("Albuquerque, New Mexico"). */
  name: string;
  rate: number;
}

export interface EnergyFrame {
  /** AudioContext seconds. */
  at: number;
  /** 0–1. */
  value: number;
}

/** One moment of My phone's motion (motion.ts makes these). */
export interface MotionFrame {
  /** AudioContext seconds. */
  at: number;
  /** −1..1, 0 at the centre; + is the right side down. */
  tiltX: number;
  /** −1..1, 0 at the centre; + is forward (the top tipped away). */
  tiltY: number;
  /** 0..1: 0° (north) clockwise to 360°. Slow. */
  heading: number;
  /** 0..1: jumps with a shake, then falls away. */
  shake: number;
}

/**
 * Where My phone is: off (not asked, or turned off), blocked (the phone said no), live, paused (the screen locked or
 * the page was hidden), none (no motion sensor here).
 */
export type MotionState = "off" | "blocked" | "live" | "paused" | "none";
export const MOTION_STATES: readonly MotionState[] = ["off", "blocked", "live", "paused", "none"];

export type SourceState = "live" | "quiet" | "offline" | "off";
export type OffReason = "removed" | "hold";

export type SituationMessage =
  | { v: typeof SITUATION_VERSION; kind: "energy"; source: string; frames: EnergyFrame[] }
  | {
      v: typeof SITUATION_VERSION;
      kind: "table";
      source: string;
      /** Rises by one per table sent on this lane; a receiver drops one older than what it has. */
      seq: number;
      at: number;
      speed: TableSpeed;
      station: Station | null;
      /** How far behind real time the cycle's ground motion is, in seconds (null: a recording). */
      behindSec: number | null;
      samples: Float32Array;
      /** The cycle's RMS (after normalising to peak 1), for level compensation. */
      rms: number;
    }
  | {
      v: typeof SITUATION_VERSION;
      kind: "status";
      source: string;
      state: SourceState;
      station: Station | null;
      /** Now minus the newest sample's time, in seconds (null: none yet). */
      newestAgeSec: number | null;
      /** Now minus the real-time lane's playhead, in seconds (null: none yet). */
      behindSec: number | null;
      /** Epoch ms of the next reconnect attempt, while offline. */
      retryAt?: number;
      hold: boolean;
      /** The data credit to show beside anything made from it. */
      credit: string;
      /** True while the source plays the bundled recording instead of a live station. */
      recorded?: boolean;
      /** My phone's state (0.2.0; absent from older sources). */
      motion?: MotionState;
    }
  | { v: typeof SITUATION_VERSION; kind: "motion"; source: string; frames: MotionFrame[] }
  | {
      v: typeof SITUATION_VERSION;
      kind: "shake";
      source: string;
      /** AudioContext seconds. */
      at: number;
      /** 0..1: how hard. */
      strength: number;
    }
  | { v: typeof SITUATION_VERSION; kind: "off"; source: string; reason: OffReason };

export type SituationKind = SituationMessage["kind"];

/** What a receiver wants from a source: Energy frames, Ground tables at one Speed, and/or My phone's motion. */
export interface SituationWants {
  energy?: boolean;
  table?: { speed: TableSpeed };
  /** `motion` frames and `shake` events (0.2.0). */
  motion?: boolean;
}

/**
 * The signals a source gives, as instruments offer them: the id a patch or preset saves (never changes, so old saves
 * still load), the name players see, and which group it belongs to. Ground Energy was "ARIA Energy" before 0.2.0
 * (Peter, 2026-11-14: renamed; its id `aria:energy` stays).
 */
export const SITUATION_SIGNALS = [
  { id: "aria:energy", key: "energy", label: "Ground Energy", group: "ground", bipolar: false },
  { id: "aria:phone-tilt-x", key: "tiltX", label: "Phone Tilt X", group: "phone", bipolar: true },
  { id: "aria:phone-tilt-y", key: "tiltY", label: "Phone Tilt Y", group: "phone", bipolar: true },
  { id: "aria:phone-shake", key: "shake", label: "Phone Shake", group: "phone", bipolar: false },
  { id: "aria:phone-heading", key: "heading", label: "Phone Heading", group: "phone", bipolar: false },
] as const;
export type SituationSignal = (typeof SITUATION_SIGNALS)[number];
export type SituationSignalId = SituationSignal["id"];
export type SituationSignalKey = SituationSignal["key"];
/** The groups' names, after the source's ("ARIA 1 · Ground"). */
export const SIGNAL_GROUP_LABELS = { ground: "Ground", phone: "My phone" } as const;
/** A signal by its saved id, or undefined. */
export const situationSignal = (id: string): SituationSignal | undefined =>
  SITUATION_SIGNALS.find((s) => s.id === id);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const str = (x: unknown, max = MAX_ID_LENGTH): x is string =>
  typeof x === "string" && x.length > 0 && x.length <= max;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const STATES: readonly SourceState[] = ["live", "quiet", "offline", "off"];
const OFF_REASONS: readonly OffReason[] = ["removed", "hold"];
const bi = (x: number) => (x < -1 ? -1 : x > 1 ? 1 : x);
const CODE = /^[A-Z0-9?*-]{0,8}$/i;

/** A copy of a Station, or null when it isn't one. */
export function parseStation(x: unknown): Station | null {
  if (!isObj(x)) return null;
  const { net, sta, loc, cha, name, rate } = x;
  if (typeof net !== "string" || typeof sta !== "string" || typeof loc !== "string" || typeof cha !== "string")
    return null;
  if (![net, sta, loc, cha].every((c) => CODE.test(c)) || !net || !sta) return null;
  if (typeof name !== "string" || name.length > MAX_ID_LENGTH) return null;
  if (!finite(rate) || rate < 0 || rate > 10000) return null;
  return { net, sta, loc, cha, name, rate };
}

/** "IU.ANMO.00.BHZ" */
export function stationId(s: Pick<Station, "net" | "sta" | "loc" | "cha">): string {
  return [s.net, s.sta, s.loc, s.cha].join(".");
}

/** The samples of a table message as a fresh Float32Array, or null if they aren't TABLE_SIZE finite values. */
function parseSamples(x: unknown): Float32Array | null {
  const len = (x as { length?: unknown } | null)?.length;
  if (!(x instanceof Float32Array) && !Array.isArray(x) && !ArrayBuffer.isView(x)) return null;
  if (len !== TABLE_SIZE) return null;
  const out = new Float32Array(TABLE_SIZE);
  const src = x as ArrayLike<number>;
  for (let i = 0; i < TABLE_SIZE; i++) {
    const v = Number(src[i]);
    if (!Number.isFinite(v)) return null;
    out[i] = v < -1 ? -1 : v > 1 ? 1 : v;
  }
  return out;
}

/**
 * Check a message from another frame and copy it. Returns null for anything that isn't a valid v1 message (wrong
 * shape, a newer major version, an unknown kind). Values are clamped into range; frames past the limit are dropped.
 */
export function parseSituationMessage(x: unknown): SituationMessage | null {
  if (!isObj(x)) return null;
  const v = x.v;
  if (typeof v !== "number" || Math.floor(v) !== SITUATION_VERSION) return null;
  if (!str(x.source)) return null;
  const source = x.source;
  switch (x.kind) {
    case "energy": {
      if (!Array.isArray(x.frames)) return null;
      const frames: EnergyFrame[] = [];
      for (const f of x.frames.slice(0, MAX_ENERGY_FRAMES)) {
        if (!isObj(f) || !finite(f.at) || !finite(f.value)) return null;
        frames.push({ at: f.at, value: clamp01(f.value) });
      }
      return { v: SITUATION_VERSION, kind: "energy", source, frames };
    }
    case "table": {
      if (!finite(x.seq) || x.seq < 0 || !finite(x.at) || !finite(x.rms) || x.rms < 0) return null;
      if (!TABLE_SPEEDS.includes(x.speed as TableSpeed)) return null;
      const samples = parseSamples(x.samples);
      if (!samples) return null;
      const station = x.station === null ? null : parseStation(x.station);
      if (x.station !== null && !station) return null;
      const behindSec = x.behindSec === null ? null : finite(x.behindSec) ? x.behindSec : undefined;
      if (behindSec === undefined) return null;
      return {
        v: SITUATION_VERSION,
        kind: "table",
        source,
        seq: Math.floor(x.seq),
        at: x.at,
        speed: x.speed as TableSpeed,
        station,
        behindSec,
        samples,
        rms: Math.min(1, x.rms),
      };
    }
    case "status": {
      if (!STATES.includes(x.state as SourceState)) return null;
      const station = x.station === null ? null : parseStation(x.station);
      if (x.station !== null && !station) return null;
      const num = (n: unknown) => (n === null ? null : finite(n) ? n : undefined);
      const newestAgeSec = num(x.newestAgeSec);
      const behindSec = num(x.behindSec);
      if (newestAgeSec === undefined || behindSec === undefined) return null;
      if (typeof x.hold !== "boolean") return null;
      if (typeof x.credit !== "string" || x.credit.length > MAX_CREDIT_LENGTH) return null;
      const out: SituationMessage = {
        v: SITUATION_VERSION,
        kind: "status",
        source,
        state: x.state as SourceState,
        station,
        newestAgeSec,
        behindSec,
        hold: x.hold,
        credit: x.credit,
      };
      if (finite(x.retryAt)) out.retryAt = x.retryAt;
      if (x.recorded === true) out.recorded = true;
      if (MOTION_STATES.includes(x.motion as MotionState)) out.motion = x.motion as MotionState;
      return out;
    }
    case "motion": {
      if (!Array.isArray(x.frames)) return null;
      const frames: MotionFrame[] = [];
      for (const f of x.frames.slice(0, MAX_MOTION_FRAMES)) {
        if (!isObj(f) || !finite(f.at) || !finite(f.tiltX) || !finite(f.tiltY) || !finite(f.heading) || !finite(f.shake))
          return null;
        const h = f.heading % 1;
        frames.push({ at: f.at, tiltX: bi(f.tiltX), tiltY: bi(f.tiltY), heading: h < 0 ? h + 1 : h, shake: clamp01(f.shake) });
      }
      return { v: SITUATION_VERSION, kind: "motion", source, frames };
    }
    case "shake": {
      if (!finite(x.at) || !finite(x.strength)) return null;
      return { v: SITUATION_VERSION, kind: "shake", source, at: x.at, strength: clamp01(x.strength) };
    }
    case "off": {
      if (!OFF_REASONS.includes(x.reason as OffReason)) return null;
      return { v: SITUATION_VERSION, kind: "off", source, reason: x.reason as OffReason };
    }
    default:
      return null;
  }
}

/** Build an `energy` message. */
export function energyMessage(source: string, frames: EnergyFrame[]): SituationMessage {
  return { v: SITUATION_VERSION, kind: "energy", source, frames: frames.slice(0, MAX_ENERGY_FRAMES) };
}

/** Build a `table` message. */
export function tableMessage(
  source: string,
  t: { seq: number; at: number; speed: TableSpeed; station: Station | null; behindSec: number | null; samples: Float32Array; rms: number },
): SituationMessage {
  return { v: SITUATION_VERSION, kind: "table", source, ...t };
}

/** Build an `off` message. */
export function offMessage(source: string, reason: OffReason): SituationMessage {
  return { v: SITUATION_VERSION, kind: "off", source, reason };
}

/** Build a `motion` message. */
export function motionMessage(source: string, frames: MotionFrame[]): SituationMessage {
  return { v: SITUATION_VERSION, kind: "motion", source, frames: frames.slice(0, MAX_MOTION_FRAMES) };
}

/** Build a `shake` message (a Shake event). */
export function shakeMessage(source: string, at: number, strength: number): SituationMessage {
  return { v: SITUATION_VERSION, kind: "shake", source, at, strength };
}

/** A copy of what a receiver asked for, or null when it asked for nothing valid. */
export function parseWants(x: unknown): SituationWants | null {
  if (!isObj(x)) return null;
  const out: SituationWants = {};
  if (x.energy === true) out.energy = true;
  if (isObj(x.table) && TABLE_SPEEDS.includes(x.table.speed as TableSpeed))
    out.table = { speed: x.table.speed as TableSpeed };
  if (x.motion === true) out.motion = true;
  return out.energy || out.table || out.motion ? out : null;
}
