/**
 * SeedLink 3.1 over WebSocket, as EarthScope's ringserver speaks it (wss://rtserve.earthscope.org/seedlink,
 * subprotocol "SeedLink3.1"); the protocol pieces only, no socket. Ported from Ground Wave; details follow seisplotjs
 * (MIT, Philip Crotwell). The client sends HELLO, STATION, SELECT, TIME (10 minutes back, so the history fills at
 * once), END; each command is answered with text until END, then every frame is "SL" + 6 hex digits + a 512-byte
 * miniSEED record.
 */

export const DEFAULT_SEEDLINK_URL = "wss://rtserve.earthscope.org/seedlink";
export const SEEDLINK_PROTOCOL = "SeedLink3.1";
/** How much history to ask for on connect. */
export const HISTORY_MS = 10 * 60 * 1000;

export interface ChannelSpec {
  net: string;
  sta: string;
  loc: string;
  cha: string;
}

/** The handshake for a channel, given now (epoch ms). */
export function handshake(spec: ChannelSpec, nowMs: number): string[] {
  const back = new Date(nowMs - HISTORY_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  const time = `TIME ${back.getUTCFullYear()},${p(back.getUTCMonth() + 1)},${p(back.getUTCDate())},${p(back.getUTCHours())},${p(back.getUTCMinutes())},${p(back.getUTCSeconds())}`;
  const loc = spec.loc === "--" ? "" : spec.loc;
  return ["HELLO", `STATION ${spec.sta} ${spec.net}`, `SELECT ${loc}${spec.cha}.D`, time, "END"];
}

/** A command as sent on the wire (HELLO and END end with CR, the others CR LF, as ringserver expects). */
export function wire(cmd: string): string {
  return cmd === "HELLO" || cmd === "END" ? `${cmd}\r` : `${cmd}\r\n`;
}

/** A data frame's sequence number and record, or null when the bytes are not a data frame. */
export function dataFrame(bytes: Uint8Array): { seq: number; record: DataView } | null {
  if (bytes.length < 8 + 64 || bytes[0] !== 83 || bytes[1] !== 76) return null;
  const hex = String.fromCharCode(...bytes.subarray(2, 8));
  if (!/^[0-9A-F]{6}$/i.test(hex)) return null;
  return {
    seq: Number.parseInt(hex, 16),
    record: new DataView(bytes.buffer, bytes.byteOffset + 8, bytes.length - 8),
  };
}

/** True when a reply to a command (other than HELLO) accepts it. */
export function accepted(reply: string): boolean {
  return /^OK/.test(reply.trim());
}

/** Parse "NET STA [LOC] [CHA]" typed by the player ("IU ANMO 00 BHZ"); null when it isn't one. */
export function parseChannel(text: string): ChannelSpec | null {
  const parts = text
    .trim()
    .toUpperCase()
    .split(/[\s.]+/)
    .filter(Boolean);
  const [net, sta, loc = "00", cha = "BHZ"] = parts;
  if (!net || !sta || parts.length > 4) return null;
  const ok = (s: string, re: RegExp) => re.test(s);
  if (
    !ok(net, /^[A-Z0-9]{1,2}$/) ||
    !ok(sta, /^[A-Z0-9]{1,5}$/) ||
    !ok(loc, /^([A-Z0-9]{0,2}|--)$/) ||
    !ok(cha, /^[A-Z0-9]{3}$/)
  )
    return null;
  return { net, sta, loc, cha };
}

/** The reconnect delay after `failures` failures in a row: 3, 6, 12, 24, 48, then 60 s, ±20 % (`jitter` in 0–1). */
export function backoffMs(failures: number, jitter: number): number {
  const base = Math.min(60_000, 3000 * 2 ** Math.max(0, failures - 1));
  return Math.round(base * (0.8 + 0.4 * Math.min(1, Math.max(0, jitter))));
}
