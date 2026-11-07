/// <reference lib="webworker" />
/**
 * ARIA's worker: the one SeedLink connection (EarthScope asks users to keep to at most 5), the stream, the Speed lanes
 * and Energy (engine.ts), off the Studio's busy main thread. The page sends it what to listen to and which lanes
 * receivers want; it sends back status, tables, Energy and a 10-minute overview.
 *
 *  - Reconnects back off 3, 6, 12, 24, 48, then 60 s (±20 %), reset after 5 minutes live.
 *  - A station that sends nothing three times running: its fallback is tried (if it has one), else retrying stops
 *    ("… sent no data. Try another station.").
 *  - While there is no live data the bundled 2010 recording plays, so the Ground table always moves.
 *  - Open tabs count each other over a BroadcastChannel: with four others connected, this one waits.
 */
import type { TableSpeed } from "@netcomposer/nc-situation";
import { AriaEngine } from "./engine";
import { type MseedRecord, parseAll, parseRecord } from "./mseed";
import {
  type ChannelSpec,
  SEEDLINK_PROTOCOL,
  accepted,
  backoffMs,
  dataFrame,
  handshake,
  wire,
} from "./seedlink";

export type StationSpec = ChannelSpec & { name: string; fallback?: ChannelSpec & { name: string } };

export type ToWorker =
  | { type: "start"; station: StationSpec; url: string; recordingUrl: string }
  | { type: "recording"; recordingUrl: string }
  | { type: "speeds"; speeds: TableSpeed[] }
  | { type: "smoothing"; sec: number }
  | { type: "hold"; on: boolean }
  | { type: "stop" };

export interface WorkerStatus {
  type: "status";
  state: "live" | "quiet" | "offline" | "off";
  station: (ChannelSpec & { name: string; rate: number }) | null;
  newestAgeSec: number | null;
  behindSec: number | null;
  retryAt?: number;
  recorded: boolean;
  note: string;
}

export type FromWorker =
  | WorkerStatus
  | {
      type: "tables";
      tables: {
        speed: TableSpeed;
        seq: number;
        samples: Float32Array;
        rms: number;
        behindSec: number | null;
      }[];
    }
  | { type: "energy"; value: number }
  | {
      type: "overview";
      min: Float32Array;
      max: Float32Array;
      playhead: number;
      window: number;
      table: Float32Array | null;
    };

const TICK_MS = 50;
const QUIET_MS = 120_000;
const NO_DATA_MS = 20_000;
const STABLE_MS = 5 * 60_000;
const MAX_EMPTY = 3;
const CENSUS_MS = 5000;
const CENSUS_LIMIT = 4;

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: FromWorker, transfer: Transferable[] = []) => scope.postMessage(m, transfer);

const engine = new AriaEngine();
let hold = false;
let url = "";
let recordingUrl = "";
let target: StationSpec | null = null;
let active: (ChannelSpec & { name: string }) | null = null;
let usingFallback = false;
let ws: WebSocket | null = null;
let gotData = false;
let lastPacket = 0;
let liveSince = 0;
let failures = 0;
let empties = 0;
let retryAt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let noDataTimer: ReturnType<typeof setTimeout> | undefined;
let note = "";
let stopped = true;
let recording: MseedRecord[] | null = null;
let lastTick = Date.now();
let lastOverview = 0;
let latestTable: Float32Array | null = null;

// --- census: how many other tabs are connected
const me = Math.random().toString(36).slice(2);
const others = new Map<string, number>();
let census: BroadcastChannel | null = null;
try {
  census = new BroadcastChannel("aria-seedlink");
  census.onmessage = (e) => {
    const m = e.data as { id?: string; live?: boolean };
    if (typeof m?.id !== "string" || m.id === me) return;
    if (m.live) others.set(m.id, Date.now());
    else others.delete(m.id);
  };
} catch {
  census = null;
}
const othersLive = () => {
  const now = Date.now();
  let n = 0;
  for (const [id, t] of others)
    if (now - t < CENSUS_MS * 2.5) n++;
    else others.delete(id);
  return n;
};
setInterval(() => census?.postMessage({ id: me, live: !!ws }), CENSUS_MS);

function status(): WorkerStatus {
  const now = Date.now();
  const live = engine.mode === "live";
  const state: WorkerStatus["state"] = stopped
    ? "off"
    : live && ws && now - lastPacket < QUIET_MS
      ? "live"
      : live && ws
        ? "quiet"
        : "offline";
  const station =
    live && active
      ? { ...active, rate: engine.buffer.rate }
      : engine.mode === "recording"
        ? {
            net: "IU",
            sta: "ANMO",
            loc: "00",
            cha: "BHZ",
            name: "Albuquerque, 27 Feb 2010",
            rate: engine.buffer.rate,
          }
        : null;
  const s: WorkerStatus = {
    type: "status",
    state,
    station,
    newestAgeSec: engine.newestAgeSec(now),
    behindSec: engine.behindSec(now),
    recorded: engine.mode === "recording",
    note,
  };
  if (state === "offline" && retryAt > now) s.retryAt = retryAt;
  return s;
}

async function playRecording(): Promise<void> {
  if (engine.mode === "recording") return;
  try {
    if (!recording) {
      const r = await fetch(recordingUrl);
      recording = parseAll(await r.arrayBuffer());
    }
    if (engine.mode !== "live" || !gotData) engine.loadRecording(recording);
  } catch {
    note = note || "The recording could not be loaded.";
  }
}

function closeSocket(): void {
  clearTimeout(noDataTimer);
  if (ws) {
    ws.onclose = ws.onmessage = ws.onerror = ws.onopen = null;
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    ws = null;
  }
}

function scheduleRetry(): void {
  clearTimeout(retryTimer);
  if (stopped) return;
  failures++;
  const wait = backoffMs(failures, Math.random());
  retryAt = Date.now() + wait;
  retryTimer = setTimeout(connect, wait);
}

/** The station sent nothing (refused, closed, or silent for 20 s). */
function empty(why: string): void {
  closeSocket();
  empties++;
  if (!gotData) void playRecording();
  if (empties >= MAX_EMPTY && target) {
    const fb = target.fallback;
    if (fb && !usingFallback) {
      usingFallback = true;
      active = fb;
      empties = 0;
      failures = 0;
      note = `${target.net}.${target.sta} sent no data; listening to ${fb.name} instead.`;
      connect();
      return;
    }
    note = `${active?.net}.${active?.sta} sent no data. Try another station.`;
    retryAt = 0;
    return;
  }
  note = why;
  scheduleRetry();
}

function connect(): void {
  clearTimeout(retryTimer);
  closeSocket();
  if (stopped || !active) return;
  if (othersLive() >= CENSUS_LIMIT) {
    note = "Four other tabs are listening to the ground. Pause one to connect here.";
    if (!gotData) void playRecording();
    retryAt = Date.now() + 15_000;
    retryTimer = setTimeout(connect, 15_000);
    return;
  }
  const spec = active;
  const steps = handshake(spec, Date.now());
  let step = 0;
  let sawData = false;
  let socket: WebSocket;
  try {
    socket = new WebSocket(url, SEEDLINK_PROTOCOL);
  } catch {
    empty("The live feed could not be opened.");
    return;
  }
  ws = socket;
  socket.binaryType = "arraybuffer";
  const send = () => socket.send(wire(steps[step]!));
  socket.onopen = () => send();
  socket.onerror = () => {};
  socket.onclose = () => {
    if (ws !== socket) return;
    ws = null;
    clearTimeout(noDataTimer);
    if (sawData) {
      note = "Reconnecting…";
      if (Date.now() - liveSince > STABLE_MS) failures = 0;
      scheduleRetry();
    } else empty("The server closed the connection before sending data.");
  };
  socket.onmessage = (ev) => {
    const bytes = typeof ev.data === "string" ? null : new Uint8Array(ev.data as ArrayBuffer);
    const frame = step >= steps.length - 1 && bytes ? dataFrame(bytes) : null;
    if (!frame) {
      if (step >= steps.length - 1) return; // stray text after END
      const txt =
        typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
      const cmd = steps[step]!;
      if (cmd !== "HELLO" && !accepted(txt)) {
        if (cmd.startsWith("TIME")) {
          steps[step] = "DATA"; // no history: just go live
          send();
          return;
        }
        empty(`The server refused "${cmd}".`);
        return;
      }
      step++;
      send();
      return;
    }
    try {
      const rec = parseRecord(frame.record);
      if (!sawData) {
        sawData = true;
        if (!gotData || engine.mode !== "live") engine.clear("live");
        gotData = true;
        liveSince = Date.now();
        empties = 0;
        note = "";
        retryAt = 0;
      }
      engine.add(rec);
      lastPacket = Date.now();
    } catch {
      /* a record that can't be read is skipped */
    }
  };
  noDataTimer = setTimeout(() => {
    if (ws === socket && !sawData)
      empty("The station was accepted but sent no data in 20 seconds.");
  }, NO_DATA_MS);
}

function tick(): void {
  const now = Date.now();
  const dt = Math.min(0.25, (now - lastTick) / 1000);
  lastTick = now;
  engine.silent = engine.mode === "live" && (!ws || now - lastPacket > QUIET_MS);
  const out = engine.tick(now, dt, hold);
  if (out.tables.length && !hold) {
    const one = out.tables.find((t) => t.speed === 1);
    if (one) latestTable = one.samples.slice();
    post(
      { type: "tables", tables: out.tables },
      out.tables.map((t) => t.samples.buffer),
    );
  }
  if (out.energy !== null && !hold) post({ type: "energy", value: out.energy });
  if (now - lastOverview >= 1000) {
    lastOverview = now;
    const o = engine.overview();
    post({ type: "overview", ...o, table: latestTable }, [o.min.buffer, o.max.buffer]);
    post(status());
  }
}
setInterval(tick, TICK_MS);

scope.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  switch (m.type) {
    case "start":
      stopped = false;
      url = m.url;
      recordingUrl = m.recordingUrl;
      target = m.station;
      active = {
        net: m.station.net,
        sta: m.station.sta,
        loc: m.station.loc,
        cha: m.station.cha,
        name: m.station.name,
      };
      usingFallback = false;
      gotData = false;
      failures = empties = 0;
      note = "";
      engine.clear("none");
      connect();
      break;
    case "recording":
      stopped = false;
      recordingUrl = m.recordingUrl;
      target = active = null;
      closeSocket();
      clearTimeout(retryTimer);
      gotData = false;
      note = "";
      engine.clear("none");
      void playRecording();
      break;
    case "speeds":
      engine.setSpeeds(m.speeds);
      break;
    case "smoothing":
      engine.smoothingSec = Math.max(0, Math.min(30, m.sec));
      break;
    case "hold":
      hold = m.on;
      break;
    case "stop":
      stopped = true;
      closeSocket();
      clearTimeout(retryTimer);
      engine.clear("none");
      break;
  }
  post(status());
};
