/**
 * My phone's sensors (Peter, 2026-11-14): asking for motion, listening to it, and keeping the screen on while it is
 * live. ARIA runs in the Studio's same-origin frame; the frame's `allow` list names accelerometer, gyroscope and
 * magnetometer.
 *
 * iOS asks once per visit: DeviceMotionEvent.requestPermission() and DeviceOrientationEvent.requestPermission() must
 * be called inside the tap itself, in this frame (requestFromTap is called synchronously from the click handler, both
 * at once, before any await). Safari remembers a No until it is closed. Other phones need no question; a browser that
 * blocks motion simply sends nothing, and a computer without a sensor sends empty readings.
 */
import type { MotionReading } from "@netcomposer/nc-situation";

export type Ask = "granted" | "denied" | "needs-tap";
/** How this browser gets motion: "ask" (iOS: a tap and a question), "open" (a phone that just sends it), "none". */
export type Support = "ask" | "open" | "none";

type PermissionCtor = { requestPermission?: () => Promise<string> };

/**
 * How this browser gets motion. A computer (no touch screen) has no motion sensor to speak of, even where its browser
 * offers requestPermission (desktop Chrome does): it shows "Open the Studio on your phone". A touch device asks
 * ("ask": iOS, and browsers with requestPermission) or just listens ("open").
 */
export function motionSupport(win: Window = window): Support {
  const w = win as Window & {
    DeviceMotionEvent?: PermissionCtor;
    DeviceOrientationEvent?: PermissionCtor;
  };
  if (!w.DeviceOrientationEvent && !w.DeviceMotionEvent) return "none";
  let touch = false;
  try {
    touch = w.matchMedia("(any-pointer: coarse)").matches;
  } catch {
    /* no media queries: treat as a computer */
  }
  if (!touch) return "none";
  if (
    typeof w.DeviceMotionEvent?.requestPermission === "function" ||
    typeof w.DeviceOrientationEvent?.requestPermission === "function"
  )
    return "ask";
  return "open";
}

/** True on iPhone and iPad (the blocked steps are Safari's). */
export function isIos(win: Window = window): boolean {
  const n = win.navigator;
  return (
    /iPhone|iPad|iPod/.test(n.userAgent) || (n.platform === "MacIntel" && n.maxTouchPoints > 1)
  );
}

/**
 * Ask for motion. Call it synchronously inside a tap's click handler (iOS needs the tap, in this frame): both
 * questions start before anything awaits. Without a tap (a Scene loaded with motion on) iOS answers only if this visit
 * already said yes; otherwise "needs-tap".
 */
export function requestMotion(win: Window = window): Promise<Ask> {
  const w = win as Window & {
    DeviceMotionEvent?: PermissionCtor;
    DeviceOrientationEvent?: PermissionCtor;
  };
  const asks: Promise<string>[] = [];
  for (const C of [w.DeviceMotionEvent, w.DeviceOrientationEvent]) {
    if (typeof C?.requestPermission !== "function") continue;
    try {
      asks.push(Promise.resolve(C.requestPermission()));
    } catch (e) {
      asks.push(Promise.reject(e));
    }
  }
  if (!asks.length) return Promise.resolve("granted");
  return Promise.all(asks).then(
    (answers) => (answers.every((a) => a === "granted") ? "granted" : "denied"),
    // NotAllowedError: no tap (and no earlier yes this visit).
    () => "needs-tap",
  );
}

interface OrientationLike {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute?: boolean;
  webkitCompassHeading?: number;
}
interface MotionLike {
  acceleration: { x: number | null; y: number | null; z: number | null } | null;
  accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null } | null;
}
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const vec = (v: MotionLike["acceleration"]) =>
  v && num(v.x) && num(v.y) && num(v.z) ? { x: v.x, y: v.y, z: v.z } : null;

/** Degrees clockwise from north: iOS's compass heading, or an absolute alpha (counter-clockwise) turned round. */
export function headingOf(e: OrientationLike): number | null {
  if (num(e.webkitCompassHeading) && e.webkitCompassHeading >= 0) return e.webkitCompassHeading;
  if (e.absolute && num(e.alpha)) return (360 - e.alpha) % 360;
  return null;
}

export interface Listening {
  stop(): void;
  /** Readings per second over the last second. */
  rate(): number;
  /** Any reading with values so far. */
  readonly gotData: boolean;
}

/**
 * Listen to the sensors: a reading per devicemotion event (with the latest orientation), or per orientation event on
 * a phone that sends no motion. `onReading` gets each one with its time in seconds (performance.now's timebase).
 */
export function listen(win: Window, onReading: (r: MotionReading) => void): Listening {
  let beta: number | null = null;
  let gamma: number | null = null;
  let heading: number | null = null;
  let motionSeen = false;
  let gotData = false;
  const times: number[] = [];
  const screenAngle = () => {
    try {
      const a = win.screen.orientation?.angle;
      if (num(a)) return a;
    } catch {
      /* old browser */
    }
    const legacy = (win as Window & { orientation?: number }).orientation;
    return num(legacy) ? legacy : 0;
  };
  const emit = (accel: MotionReading["accel"], accelG: MotionReading["accelG"]) => {
    const t = win.performance.now() / 1000;
    if (num(beta) || accel || accelG) gotData = true;
    times.push(t);
    while (times.length && times[0]! < t - 1) times.shift();
    onReading({ t, beta, gamma, heading, accel, accelG, screenAngle: screenAngle() });
  };
  const onOrientation = (ev: Event) => {
    const e = ev as unknown as OrientationLike;
    if (num(e.beta) && num(e.gamma)) {
      beta = e.beta;
      gamma = e.gamma;
    }
    const h = headingOf(e);
    if (h !== null) heading = h;
    if (!motionSeen && num(e.beta)) emit(null, null);
  };
  const onAbsolute = (ev: Event) => {
    const e = ev as unknown as OrientationLike;
    const h = headingOf({ alpha: e.alpha, beta: e.beta, gamma: e.gamma, absolute: true });
    if (h !== null) heading = h;
  };
  const onMotion = (ev: Event) => {
    const e = ev as unknown as MotionLike;
    const accel = vec(e.acceleration);
    const accelG = vec(e.accelerationIncludingGravity);
    if (accel || accelG) motionSeen = true;
    emit(accel, accelG);
  };
  win.addEventListener("deviceorientation", onOrientation);
  win.addEventListener("deviceorientationabsolute", onAbsolute);
  win.addEventListener("devicemotion", onMotion);
  return {
    stop() {
      win.removeEventListener("deviceorientation", onOrientation);
      win.removeEventListener("deviceorientationabsolute", onAbsolute);
      win.removeEventListener("devicemotion", onMotion);
    },
    rate: () => {
      const now = win.performance.now() / 1000;
      return times.filter((t) => t > now - 1).length;
    },
    get gotData() {
      return gotData;
    },
  };
}

/** The screen kept on while motion is live (Screen Wake Lock), taken again when the page is back on screen. */
export function wakeLock(win: Window = window) {
  type Sentinel = { release(): Promise<void>; addEventListener?(t: string, l: () => void): void };
  const nav = win.navigator as Navigator & {
    wakeLock?: { request(type: "screen"): Promise<Sentinel> };
  };
  let want = false;
  let sentinel: Sentinel | null = null;
  const take = () => {
    if (!want || sentinel || !nav.wakeLock || win.document.visibilityState !== "visible") return;
    nav.wakeLock
      .request("screen")
      .then((s) => {
        if (!want) {
          void s.release().catch(() => {});
          return;
        }
        sentinel = s;
        s.addEventListener?.("release", () => {
          if (sentinel === s) sentinel = null;
        });
      })
      .catch(() => {
        /* refused (battery saver, a hidden page): the screen may sleep */
      });
  };
  win.document.addEventListener("visibilitychange", take);
  return {
    supported: !!nav.wakeLock,
    set(on: boolean) {
      want = on;
      if (on) take();
      else if (sentinel) {
        const s = sentinel;
        sentinel = null;
        void s.release().catch(() => {});
      }
    },
    get held() {
      return sentinel !== null;
    },
  };
}
