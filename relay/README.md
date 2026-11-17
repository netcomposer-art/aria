# nc-remote: ARIA's phone remote relay

ARIA's **A phone with this Studio** (My phone) pairs a phone with the Studio on a computer. The two browsers can't
reach each other directly, so both open a WebSocket to this relay, a Cloudflare Worker with one Durable Object per
pairing code. It passes the phone's motion readings and the delay pings between them and stores nothing (only the
time of the last message, so an idle room closes after 10 minutes).

- `src/room.ts`: the rules (codes, who may join, which messages pass, the rate limit). Pure; ARIA's tests run it.
- `src/index.ts`: the Worker and the `RemoteRoom` Durable Object (WebSocket hibernation).
- One Studio and one phone per code. A second phone is refused with words; the same tab reconnecting replaces its own
  stale socket. Messages: JSON of at most 600 bytes, kinds `m s ping pong hold hi end vis`; 150 a second per socket
  (bursts of 300), a socket that keeps flooding is closed. New sockets: 30 a minute per address.
- Only pages on `ALLOWED_ORIGINS` (https://netcomposer.art) may connect; `--var DEV:1` adds 127.0.0.1 and localhost.

## Local

```sh
npm ci
npx wrangler dev --port 8787 --ip 127.0.0.1 --var DEV:1
```

Point a page at it with `localStorage.setItem("nc-remote-relay", "ws://127.0.0.1:8787")` (ARIA and the Remote page
both read it), or `?relay=ws://127.0.0.1:8787` on the Remote page. The Studio's `tests/remote.e2e.mjs` runs against it.

## Deploy

Same Cloudflare account as `nc-perform-api` (psemme.workers.dev). It becomes `wss://nc-remote.psemme.workers.dev`,
the address ARIA and the Remote page use by default (src/remote-link.ts `DEFAULT_RELAY`).

```sh
cd relay && npm ci && npx wrangler login && npx wrangler deploy
```
