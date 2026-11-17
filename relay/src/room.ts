/**
 * The phone remote's pairing rules (Peter, 2026-11-17: "could the iPhone's sensor data modulate the desktop Studio?").
 * Pure: no Cloudflare types, so ARIA's tests (vitest) run it and the relay's Durable Object (index.ts) uses it.
 *
 * A room is a short code. The Studio on the computer opens it; one phone joins it. The relay passes the messages in
 * FORWARD between them and stores nothing.
 */

/** No 0/O, 1/I/L: a code read off a screen and typed on a phone can't be misread. 31 letters, 4 per code. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 4;

/** "k7 4q", "K7-4Q", "#K74Q" → "K74Q"; anything else null. */
export function normalizeCode(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const s = input.toUpperCase().replace(/[\s#\-_.]/g, "");
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

/** "K74Q" → "K7 4Q" (how it's shown and read out). */
export function formatCode(code: string): string {
  return `${code.slice(0, 2)} ${code.slice(2)}`;
}

/** A new code from random bytes (crypto.getRandomValues in browsers and Workers). */
export function randomCode(
  bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(CODE_LENGTH)),
): string {
  let out = "";
  // 31 letters: reject bytes ≥ 248 (8 × 31) so every letter is equally likely.
  let i = 0;
  let pool = bytes;
  while (out.length < CODE_LENGTH) {
    if (i >= pool.length) {
      pool = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
      i = 0;
    }
    const b = pool[i++]!;
    if (b < 248) out += CODE_ALPHABET[b % 31];
  }
  return out;
}

export type Role = "studio" | "phone";

/** A name shown on the other side ("Peter's iPhone", "AH EE OH v2"): printable, at most 40 characters. */
export function cleanName(input: string | null | undefined, fallback: string): string {
  if (typeof input !== "string") return fallback;
  let s = "";
  for (const ch of input) {
    const c = ch.codePointAt(0)!;
    if (c < 0x20 || c === 0x7f || ch === "<" || ch === ">") continue;
    s += ch;
  }
  s = s.trim().slice(0, 40);
  return s || fallback;
}

/** A token the same tab sends on every connect (so a reconnect replaces its own stale socket). */
export function cleanToken(input: string | null | undefined): string | null {
  return typeof input === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(input) ? input : null;
}

export interface Present {
  role: Role;
  token: string;
}

export type Why = "taken" | "no-studio" | "busy" | "bad-request";

/** What each refusal says on the other end (shown as is). */
export const WHY_TEXT: Record<Why, string> = {
  taken: "That code is in use. A new one is on its way.",
  "no-studio": "No Studio has that code open. Check the code on the computer.",
  busy: "Another phone is already paired with that Studio. End it there first.",
  "bad-request": "That link isn't a pairing link.",
};

/**
 * May a socket join? A Studio opens a free room (or replaces its own stale socket, same token); a phone joins a room
 * with a Studio and no other phone (or replaces its own stale socket). `replace`: the indexes in `present` to close.
 */
export function admit(
  who: Present,
  present: Present[],
): { ok: true; replace: number[] } | { ok: false; why: Why } {
  const same = present.flatMap((p, i) => (p.role === who.role && p.token === who.token ? [i] : []));
  const others = present.filter((p) => p.role === who.role && p.token !== who.token);
  if (who.role === "studio") {
    if (others.length) return { ok: false, why: "taken" };
    return { ok: true, replace: same };
  }
  if (!present.some((p) => p.role === "studio")) return { ok: false, why: "no-studio" };
  if (others.length) return { ok: false, why: "busy" };
  return { ok: true, replace: same };
}

/**
 * The messages the relay passes on, by their `k`: a motion reading, a Shake (a shake or Tap = Shake), the delay
 * pings, Hold, the names, End. Anything else is dropped.
 */
export const FORWARD = new Set(["m", "s", "ping", "pong", "hold", "hi", "end", "vis"]);
/** The longest message passed on (a reading is about 150 bytes). */
export const MAX_BYTES = 600;

/** The message to pass on, or null (too long, not JSON, not an object, not a kind in FORWARD). */
export function checkMessage(text: unknown): string | null {
  if (typeof text !== "string" || text.length > MAX_BYTES) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const k = (v as { k?: unknown }).k;
  return typeof k === "string" && FORWARD.has(k) ? text : null;
}

/**
 * A token bucket per socket: `rate` messages a second, bursts up to `burst`. A phone sends at most about 60 readings
 * a second plus pings; anything past the bucket is dropped, and a socket that keeps flooding is closed.
 */
export class Bucket {
  private tokens: number;
  private last: number;
  dropped = 0;
  constructor(
    private readonly rate = 150,
    private readonly burst = 300,
    now = Date.now(),
  ) {
    this.tokens = burst;
    this.last = now;
  }
  take(now = Date.now()): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    this.dropped++;
    return false;
  }
}
/** Dropped messages after which the relay closes a socket. */
export const FLOOD_LIMIT = 2000;
/** A room with no message passed for this long closes (ms). */
export const IDLE_MS = 10 * 60 * 1000;

/** Close codes the clients read. */
export const CLOSE = {
  refused: 4001,
  replaced: 4002,
  ended: 4003,
  idle: 4004,
  flood: 4005,
} as const;
