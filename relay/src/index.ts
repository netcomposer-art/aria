/**
 * nc-remote: the relay between a phone and the Studio on a computer (ARIA's "A phone with this Studio").
 *
 *   wss://nc-remote.<account>.workers.dev/room/<CODE>?role=studio|phone&token=<tab token>&name=<shown name>
 *
 * One Durable Object per code (RemoteRoom), using WebSocket hibernation. It admits one Studio and one phone
 * (room.ts), passes the small JSON messages in room.FORWARD between them, rate-limits each socket, and closes a room
 * after IDLE_MS without a message. Nothing about the motion is stored: the only storage is the time of the last
 * message, so an idle room can be closed after the object sleeps.
 */
import { DurableObject } from "cloudflare:workers";
import {
  Bucket,
  CLOSE,
  FLOOD_LIMIT,
  IDLE_MS,
  type Present,
  type Role,
  WHY_TEXT,
  type Why,
  admit,
  checkMessage,
  cleanName,
  cleanToken,
  normalizeCode,
} from "./room";

interface Env {
  ROOMS: DurableObjectNamespace<RemoteRoom>;
  ALLOWED_ORIGINS: string;
  /** "1" in local dev: pages on 127.0.0.1 / localhost may connect too. */
  DEV?: string;
  CONNECT_RATE?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

interface Attachment extends Present {
  name: string;
}

const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

export function originAllowed(
  origin: string | null,
  env: Pick<Env, "ALLOWED_ORIGINS" | "DEV">,
): boolean {
  if (!origin) return false;
  const allowed = env.ALLOWED_ORIGINS.split(/[\s,]+/).filter(Boolean);
  if (allowed.includes(origin)) return true;
  return env.DEV === "1" && LOCAL.test(origin);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/health")
      return new Response("nc-remote: ARIA's phone remote relay. Nothing is stored.\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    const m = /^\/room\/([^/]+)$/.exec(url.pathname);
    if (!m) return new Response("not found", { status: 404 });
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("expected a WebSocket", { status: 426 });
    if (!originAllowed(req.headers.get("Origin"), env))
      return new Response("origin not allowed", { status: 403 });
    const code = normalizeCode(decodeURIComponent(m[1]!));
    if (!code) return new Response("bad code", { status: 400 });
    if (env.CONNECT_RATE) {
      const ip = req.headers.get("CF-Connecting-IP") ?? "local";
      const { success } = await env.CONNECT_RATE.limit({ key: ip });
      if (!success) return new Response("too many connections; wait a minute", { status: 429 });
    }
    return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
  },
};

export class RemoteRoom extends DurableObject<Env> {
  private buckets = new Map<WebSocket, Bucket>();
  private lastSaved = 0;

  private sockets(): { ws: WebSocket; a: Attachment }[] {
    return this.ctx
      .getWebSockets()
      .map((ws) => ({ ws, a: ws.deserializeAttachment() as Attachment }))
      .filter((s) => s.a && (s.a.role === "studio" || s.a.role === "phone"));
  }

  private refuse(why: Why): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    server.send(JSON.stringify({ k: "refused", why, text: WHY_TEXT[why] }));
    server.close(CLOSE.refused, why);
    return new Response(null, { status: 101, webSocket: client });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const role = url.searchParams.get("role") as Role | null;
    const token = cleanToken(url.searchParams.get("token"));
    if ((role !== "studio" && role !== "phone") || !token) return this.refuse("bad-request");
    const name = cleanName(url.searchParams.get("name"), role === "studio" ? "Studio" : "Phone");
    const present = this.sockets();
    const verdict = admit(
      { role, token },
      present.map((s) => s.a),
    );
    if (!verdict.ok) return this.refuse(verdict.why);
    for (const i of verdict.replace) {
      try {
        present[i]!.ws.close(CLOSE.replaced, "replaced");
      } catch {
        /* already closed */
      }
    }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [role]);
    const a: Attachment = { role, token, name };
    server.serializeAttachment(a);
    const other = present.find((s, i) => s.a.role !== role && !verdict.replace.includes(i));
    server.send(JSON.stringify({ k: "hello", role, peer: other ? other.a.name : null }));
    if (other) other.ws.send(JSON.stringify({ k: "peer", role, name }));
    await this.touch(true);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let bucket = this.buckets.get(ws);
    if (!bucket) {
      bucket = new Bucket();
      this.buckets.set(ws, bucket);
    }
    if (!bucket.take()) {
      if (bucket.dropped > FLOOD_LIMIT) ws.close(CLOSE.flood, "too many messages");
      return;
    }
    const text = checkMessage(typeof message === "string" ? message : null);
    if (!text) return;
    const from = ws.deserializeAttachment() as Attachment | null;
    if (!from) return;
    const to = this.sockets().filter((s) => s.a.role !== from.role);
    for (const s of to) {
      try {
        s.ws.send(text);
      } catch {
        /* closing */
      }
    }
    if ((JSON.parse(text) as { k: string }).k === "end") {
      for (const s of this.sockets()) {
        try {
          s.ws.close(CLOSE.ended, "ended");
        } catch {
          /* closed */
        }
      }
      return;
    }
    await this.touch(false);
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    this.buckets.delete(ws);
    const a = ws.deserializeAttachment() as Attachment | null;
    try {
      ws.close(code === 1005 ? 1000 : code, "closed");
    } catch {
      /* closed */
    }
    if (!a || code === CLOSE.replaced) return;
    for (const s of this.sockets()) {
      if (s.ws === ws || s.a.role === a.role) continue;
      try {
        s.ws.send(JSON.stringify({ k: "gone", role: a.role }));
      } catch {
        /* closing */
      }
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011);
  }

  /** The time of the last message, saved at most once a minute, and the alarm that closes an idle room. */
  private async touch(force: boolean): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastSaved < 60_000) return;
    this.lastSaved = now;
    await this.ctx.storage.put("last", now);
    await this.ctx.storage.setAlarm(now + IDLE_MS);
  }

  async alarm(): Promise<void> {
    const last = ((await this.ctx.storage.get<number>("last")) ?? 0) as number;
    const sockets = this.sockets();
    if (!sockets.length || Date.now() - last >= IDLE_MS - 1000) {
      for (const s of sockets) {
        try {
          s.ws.close(CLOSE.idle, "idle");
        } catch {
          /* closed */
        }
      }
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(last + IDLE_MS);
  }
}
