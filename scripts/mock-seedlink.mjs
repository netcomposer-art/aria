#!/usr/bin/env node
// A ringserver-like SeedLink 3.1 server over WebSocket, for tests and local checks (Ground Wave's mock-sl.js, grown).
// It replays a miniSEED file's 512-byte records with fresh times: on END, ten minutes of history up to ~15 s ago at
// once, then each record as real time reaches it (in bursts, as a real station's records arrive).
//
//   node scripts/mock-seedlink.mjs [--file public/anmo-2010-02-27.mseed] [--port 18000]
//        [--refuse STA,...]  answer STATION with ERROR for these stations
//        [--silent STA,...]  accept these stations but send no data
//        [--drop-after N]    close every connection after N data packets (reconnect checks)
//
// Every connection, command and drop is appended to the log file given by --log (JSON lines), so a test can check
// what the client sent (e.g. at most one connection at a time).
import { appendFileSync, readFileSync } from "node:fs";
import { WebSocketServer } from "ws";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const file = arg("file", new URL("../public/anmo-2010-02-27.mseed", import.meta.url).pathname);
const port = Number(arg("port", "18000"));
const refuse = new Set((arg("refuse", "") || "").split(",").filter(Boolean));
const silent = new Set((arg("silent", "") || "").split(",").filter(Boolean));
const dropAfter = Number(arg("drop-after", "0"));
const logFile = arg("log", "");
const log = (o) => logFile && appendFileSync(logFile, `${JSON.stringify({ t: Date.now(), ...o })}\n`);

const bytes = readFileSync(file);
const recs = [];
for (let o = 0; o + 512 <= bytes.length; o += 512) recs.push(Buffer.from(bytes.subarray(o, o + 512)));
const rateOf = (r) => {
  const f = r.readInt16BE(32), m = r.readInt16BE(34);
  let x = f > 0 ? f : -1 / f;
  return m > 0 ? x * m : m < 0 ? x / -m : x;
};

let open = 0;
const wss = new WebSocketServer({ port, handleProtocols: (p) => (p.has("SeedLink3.1") ? "SeedLink3.1" : false) });
wss.on("connection", (ws, req) => {
  open++;
  log({ ev: "open", open, origin: req.headers.origin ?? null, protocol: ws.protocol });
  let seq = 0, i = 0, sent = 0, timer = null, sta = "";
  let t = Date.now() - 10 * 60 * 1000;
  // A record is sent once it is complete (its last sample is in the past), as a real station's are.
  const due = () => {
    const r = recs[i % recs.length];
    return t + (r.readUInt16BE(30) / (rateOf(r) || 20)) * 1000 + 1000 < Date.now();
  };
  const pkt = () => {
    const r = Buffer.from(recs[i++ % recs.length]);
    const ns = r.readUInt16BE(30), rate = rateOf(r) || 20;
    const d = new Date(t), y = d.getUTCFullYear();
    const doy = Math.floor((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 1)) / 864e5) + 1;
    r.writeUInt16BE(y, 20); r.writeUInt16BE(doy, 22);
    r[24] = d.getUTCHours(); r[25] = d.getUTCMinutes(); r[26] = d.getUTCSeconds(); r[27] = 0;
    r.writeUInt16BE(d.getUTCMilliseconds() * 10, 28);
    t += (ns / rate) * 1000;
    sent++;
    return Buffer.concat([Buffer.from(`SL${(seq++).toString(16).toUpperCase().padStart(6, "0")}`), r]);
  };
  const send = (b) => {
    if (ws.readyState !== 1) return;
    ws.send(b);
    if (dropAfter && sent >= dropAfter) {
      log({ ev: "drop", sent });
      clearInterval(timer);
      ws.close();
    }
  };
  ws.on("message", (m) => {
    const s = m.toString();
    log({ ev: "cmd", cmd: s.trim() });
    if (s.startsWith("HELLO"))
      ws.send(Buffer.from("SeedLink v3.1 (2024.120 RingServer) :: SLPROTO:3.1 CAP EXTREPLY NSWILDCARD BATCH WS:13\rARIA mock ringserver\r\n"));
    else if (s.startsWith("STATION")) {
      sta = s.split(/\s+/)[1] ?? "";
      ws.send(Buffer.from(refuse.has(sta) ? "ERROR\r\n" : "OK\r\n"));
    } else if (s.startsWith("END")) {
      if (silent.has(sta)) return;
      while (due() && ws.readyState === 1) send(pkt());
      timer = setInterval(() => {
        if (due()) send(pkt());
      }, 500);
    } else ws.send(Buffer.from("OK\r\n"));
  });
  ws.on("close", () => {
    open--;
    clearInterval(timer);
    log({ ev: "close", open });
  });
});
console.log(`mock SeedLink on ws://127.0.0.1:${port} (${recs.length} records from ${file})`);
