/**
 * My phone (ARIA's motion source; Peter, 2026-11-14): the pure maths that turn a phone's motion sensors into the
 * Situation contract's motion signals. ARIA reads the sensors (deviceorientation, devicemotion) and feeds each reading
 * in with its own time; nothing here reads a clock.
 *
 *  - **Tilt X / Tilt Y**, −1..1, 0 at the centre: the phone's roll and pitch in the screen's frame (so a phone turned
 *    sideways still tilts left and right), against the centre, full scale at ±`TILT_RANGE_DEG`. Tilt Y is positive
 *    forward (the top tipped away from you). Smooth (0–100 %) is a one-pole glide; Invert flips a direction.
 *  - **Heading**, 0..1 (0° north, clockwise), slow: a one-pole glide on the circle (never the long way round).
 *  - **Shake**, 0..1: jumps with a jolt (acceleration without gravity), then falls away. A jolt past
 *    `SHAKE_EVENT_MS2` is also a Shake event (a trigger), at most one per `SHAKE_REFRACTORY_S`.
 *  - **Hold still to centre**: the angle held still for `CENTRE_HOLD_S` becomes the centre.
 *
 * Deterministic: the same readings at the same times give the same signals.
 */

/** Full-scale tilt, degrees from the centre. */
export const TILT_RANGE_DEG = 45;
/** Smooth at 100 % (seconds of one-pole glide); Smooth scales it linearly down to 0 (instant). */
export const SMOOTH_MAX_SEC = 0.6;
/** Heading's glide (seconds), plus Smooth's: it changes slowly. */
export const HEADING_SEC = 1.5;
/** Jolts below this (m/s², gravity removed) read 0 on the Shake level; this far above the floor reads 1. */
export const SHAKE_FLOOR_MS2 = 2.5;
export const SHAKE_FULL_MS2 = 20;
/** How fast the Shake level falls away (time constant, seconds). */
export const SHAKE_DECAY_SEC = 0.35;
/** A jolt this strong is a Shake event. */
export const SHAKE_EVENT_MS2 = 13;
/** No second Shake event sooner than this (seconds). */
export const SHAKE_REFRACTORY_S = 0.4;
/** Hold still to centre: still for this long (seconds) ... */
export const CENTRE_HOLD_S = 2;
/** ... within this many degrees of pitch and roll. */
export const STILL_DEG = 3;
/** Gives up after this long without holding still (seconds). */
export const CENTRE_GIVE_UP_S = 12;

/** A phone's angle in the screen's frame, degrees: pitch (top up from flat) and roll (right side down is +). */
export interface Angle {
  pitch: number;
  roll: number;
}
/** Where 0 is until the player centres: a phone held at a comfortable reading angle. */
export const DEFAULT_CENTRE: Readonly<Angle> = { pitch: 35, roll: 0 };

export interface MotionSettings {
  /** 0–1 (Smooth 0–100 %). */
  smooth: number;
  centre: Angle;
  invertX: boolean;
  invertY: boolean;
}
export const DEFAULT_MOTION_SETTINGS: Readonly<MotionSettings> = {
  smooth: 0.3,
  centre: DEFAULT_CENTRE,
  invertX: false,
  invertY: false,
};

/** A vector in m/s². */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One reading: whatever the sensors gave at time `t` (seconds). Missing parts are null. */
export interface MotionReading {
  t: number;
  /** deviceorientation beta and gamma, degrees. */
  beta: number | null;
  gamma: number | null;
  /** Degrees clockwise from north (iOS webkitCompassHeading, or 360 − absolute alpha), or null. */
  heading: number | null;
  /** devicemotion acceleration (gravity removed), or null. */
  accel: Vec3 | null;
  /** devicemotion accelerationIncludingGravity (used when `accel` is null), or null. */
  accelG: Vec3 | null;
  /** screen.orientation.angle: 0, 90, 180 or 270 (−90). */
  screenAngle?: number;
}

/** The four signals at one time. */
export interface MotionValues {
  tiltX: number;
  tiltY: number;
  heading: number;
  shake: number;
}

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** beta / gamma as pitch and roll in the screen's frame (the screen turned by `screenAngle` degrees). */
export function screenAngleOf(beta: number, gamma: number, screenAngle = 0): Angle {
  const a = ((Math.round(screenAngle / 90) % 4) + 4) % 4;
  if (a === 1) return { pitch: -gamma, roll: beta };
  if (a === 2) return { pitch: -beta, roll: -gamma };
  if (a === 3) return { pitch: gamma, roll: -beta };
  return { pitch: beta, roll: gamma };
}

/** Raw tilt (before smoothing), −1..1: roll and pitch against the centre, Tilt Y positive forward. */
export function tiltOf(angle: Angle, centre: Angle): { x: number; y: number } {
  return {
    x: clamp((angle.roll - centre.roll) / TILT_RANGE_DEG, -1, 1),
    y: clamp((centre.pitch - angle.pitch) / TILT_RANGE_DEG, -1, 1),
  };
}

/** The one-pole time constant (seconds) for Smooth 0–1. */
export const smoothSec = (smooth: number) => clamp(finite(smooth) ? smooth : 0, 0, 1) * SMOOTH_MAX_SEC;

/** One-pole step: move `value` toward `target` over `dt` with time constant `tau` (0: at once). */
export function glide(value: number, target: number, dt: number, tau: number): number {
  if (!(tau > 0)) return target;
  return value + (target - value) * (1 - Math.exp(-Math.max(0, dt) / tau));
}

/** The shortest signed turn from `from` to `to`, degrees (−180..180). */
export function turn(from: number, to: number): number {
  const d = (((to - from) % 360) + 540) % 360;
  return d - 180;
}

/**
 * Shake: a level that jumps with a jolt and falls away, plus a Shake event per jolt past the threshold. Feed it the
 * jolt (m/s², gravity removed) with each reading's time.
 */
export class ShakeDetector {
  level = 0;
  private t: number | null = null;
  private lastEvent = Number.NEGATIVE_INFINITY;
  /** Returns the event's strength (0–1) when this jolt is a Shake event, else null. */
  step(jolt: number, t: number): number | null {
    const dt = this.t === null ? 0 : Math.max(0, t - this.t);
    this.t = t;
    const j = finite(jolt) ? Math.max(0, jolt) : 0;
    const target = clamp((j - SHAKE_FLOOR_MS2) / (SHAKE_FULL_MS2 - SHAKE_FLOOR_MS2), 0, 1);
    this.level = Math.max(target, this.level * Math.exp(-dt / SHAKE_DECAY_SEC));
    if (j >= SHAKE_EVENT_MS2 && t - this.lastEvent >= SHAKE_REFRACTORY_S) {
      this.lastEvent = t;
      return Math.max(target, 0.01);
    }
    return null;
  }
  reset(): void {
    this.level = 0;
    this.t = null;
    this.lastEvent = Number.NEGATIVE_INFINITY;
  }
}

/** Gravity taken out of accelerationIncludingGravity (a slow low-pass), for phones that give no `acceleration`. */
export class GravityFilter {
  private g: Vec3 | null = null;
  private t: number | null = null;
  /** The jolt magnitude (m/s²) with the gravity estimate removed. */
  step(a: Vec3, t: number): number {
    const dt = this.t === null ? 0 : Math.max(0, t - this.t);
    this.t = t;
    if (!this.g) this.g = { ...a };
    else {
      const k = 1 - Math.exp(-dt / 0.25);
      this.g = { x: this.g.x + (a.x - this.g.x) * k, y: this.g.y + (a.y - this.g.y) * k, z: this.g.z + (a.z - this.g.z) * k };
    }
    return Math.hypot(a.x - this.g.x, a.y - this.g.y, a.z - this.g.z);
  }
  reset(): void {
    this.g = null;
    this.t = null;
  }
}

/** A step's result: the four signals, and a Shake event's strength (null: none this step). */
export interface MotionStep {
  values: MotionValues;
  shake: number | null;
}

/**
 * The whole chain: readings in, the four signals and Shake events out. Holds its last values through readings
 * that miss a part (a phone without a compass keeps Heading where it is).
 */
export class MotionShaper {
  private s: MotionSettings;
  private t: number | null = null;
  private x = 0;
  private y = 0;
  private headingDeg: number | null = null;
  private readonly shakeDetector = new ShakeDetector();
  private readonly gravity = new GravityFilter();
  /** The last angle read (screen frame), for centring. */
  angle: Angle | null = null;

  constructor(settings: MotionSettings = DEFAULT_MOTION_SETTINGS) {
    this.s = sanitizeMotionSettings(settings);
  }
  get settings(): MotionSettings {
    return this.s;
  }
  set(settings: MotionSettings): void {
    this.s = sanitizeMotionSettings(settings);
  }

  step(r: MotionReading): MotionStep {
    const dt = this.t === null ? 0 : Math.max(0, r.t - this.t);
    const first = this.t === null;
    this.t = r.t;
    if (finite(r.beta) && finite(r.gamma)) {
      this.angle = screenAngleOf(r.beta, r.gamma, r.screenAngle ?? 0);
      const raw = tiltOf(this.angle, this.s.centre);
      const tau = smoothSec(this.s.smooth);
      this.x = first ? raw.x : glide(this.x, raw.x, dt, tau);
      this.y = first ? raw.y : glide(this.y, raw.y, dt, tau);
    }
    if (finite(r.heading)) {
      const h = ((r.heading % 360) + 360) % 360;
      if (this.headingDeg === null) this.headingDeg = h;
      else {
        const tau = HEADING_SEC + smoothSec(this.s.smooth);
        this.headingDeg = glide(this.headingDeg, this.headingDeg + turn(this.headingDeg, h), dt, tau);
        this.headingDeg = ((this.headingDeg % 360) + 360) % 360;
      }
    }
    let jolt = 0;
    if (r.accel && finite(r.accel.x) && finite(r.accel.y) && finite(r.accel.z))
      jolt = Math.hypot(r.accel.x, r.accel.y, r.accel.z);
    else if (r.accelG && finite(r.accelG.x) && finite(r.accelG.y) && finite(r.accelG.z))
      jolt = this.gravity.step(r.accelG, r.t);
    const shake = r.accel || r.accelG ? this.shakeDetector.step(jolt, r.t) : null;
    return { values: this.values(), shake };
  }

  /** The signals now (Invert applied). */
  values(): MotionValues {
    return {
      tiltX: this.s.invertX ? -this.x : this.x,
      tiltY: this.s.invertY ? -this.y : this.y,
      heading: this.headingDeg === null ? 0 : this.headingDeg / 360,
      shake: this.shakeDetector.level,
    };
  }

  /** Forget motion (motion turned off or paused): tilt and Shake back to 0, Heading unknown. */
  reset(): void {
    this.t = null;
    this.x = this.y = 0;
    this.headingDeg = null;
    this.angle = null;
    this.shakeDetector.reset();
    this.gravity.reset();
  }
}

/**
 * Hold still to centre: feed it the angle (screen frame) with each reading's time. Movement past `STILL_DEG`
 * starts the count again. After `CENTRE_HOLD_S` still, `centre` is the mean angle over that time.
 */
export class StillCentre {
  private from: number | null = null;
  private started: number | null = null;
  private lo: Angle | null = null;
  private hi: Angle | null = null;
  private sum = { pitch: 0, roll: 0, n: 0 };
  centre: Angle | null = null;
  gaveUp = false;

  /** Seconds left of holding still (CENTRE_HOLD_S before the first reading). */
  remaining(t: number): number {
    if (this.centre) return 0;
    return this.from === null ? CENTRE_HOLD_S : Math.max(0, CENTRE_HOLD_S - (t - this.from));
  }

  step(a: Angle, t: number): void {
    if (this.centre || this.gaveUp || !finite(a.pitch) || !finite(a.roll)) return;
    if (this.started === null) this.started = t;
    const moved =
      this.lo !== null &&
      this.hi !== null &&
      (Math.max(this.hi.pitch, a.pitch) - Math.min(this.lo.pitch, a.pitch) > STILL_DEG ||
        Math.max(this.hi.roll, a.roll) - Math.min(this.lo.roll, a.roll) > STILL_DEG);
    if (this.from === null || moved) {
      this.from = t;
      this.lo = { ...a };
      this.hi = { ...a };
      this.sum = { pitch: 0, roll: 0, n: 0 };
    }
    this.lo = { pitch: Math.min(this.lo!.pitch, a.pitch), roll: Math.min(this.lo!.roll, a.roll) };
    this.hi = { pitch: Math.max(this.hi!.pitch, a.pitch), roll: Math.max(this.hi!.roll, a.roll) };
    this.sum = { pitch: this.sum.pitch + a.pitch, roll: this.sum.roll + a.roll, n: this.sum.n + 1 };
    if (t - this.from >= CENTRE_HOLD_S - 1e-9) {
      this.centre = { pitch: this.sum.pitch / this.sum.n, roll: this.sum.roll / this.sum.n };
    } else if (t - this.started >= CENTRE_GIVE_UP_S) this.gaveUp = true;
  }
}

/** A checked copy of motion settings (old or foreign values fall back to the defaults, field by field). */
export function sanitizeMotionSettings(raw: unknown): MotionSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof MotionSettings, unknown>>;
  const c = (r.centre && typeof r.centre === "object" ? r.centre : {}) as Partial<Record<keyof Angle, unknown>>;
  return {
    smooth: finite(r.smooth) ? clamp(r.smooth, 0, 1) : DEFAULT_MOTION_SETTINGS.smooth,
    centre: {
      pitch: finite(c.pitch) ? clamp(c.pitch, -180, 180) : DEFAULT_CENTRE.pitch,
      roll: finite(c.roll) ? clamp(c.roll, -90, 90) : DEFAULT_CENTRE.roll,
    },
    invertX: r.invertX === true,
    invertY: r.invertY === true,
  };
}
