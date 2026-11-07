/**
 * ARIA / SITUATION: the Studio's Situation module (Peter, 2026-11-06: v1 = Ground). It makes no sound. It listens to a
 * live seismometer (EarthScope SeedLink) in a worker and sends the Studio's instruments the Ground wavetable and
 * Energy (nc-situation's contract v1) on the situation bus. ASTRID plays the table and can use Energy as a modulation
 * source. Two modules, as the approved mockups: Station and Signals; Hold, Save and Load; the data credit.
 */
import {
  type SituationMessage,
  type TableSpeed,
  energyMessage,
  offMessage,
  tableMessage,
} from "@netcomposer/nc-situation";
import {
  HELP_ATTR,
  createSlider,
  defineModule,
  installHelpTips,
  pageMenu,
  placeModules,
} from "@netcomposer/nc-ui";
import { helpFor } from "./help";
import { parseChannel } from "./seedlink";
import {
  type AriaState,
  DEFAULTS,
  SMOOTHING_MAX,
  SMOOTHING_MIN,
  presetFile,
  readPreset,
  sanitize,
} from "./state";
import { EARTHSCOPE_ACK, PRESETS, RECORDING, credit } from "./stations";
import { type StudioSituationSource, studioHost, studioInstance } from "./studio-host";
import type { FromWorker, ToWorker, WorkerStatus } from "./worker";
import AriaWorker from "./worker?worker";
import "./style.css";

const INSTANCE = studioInstance();
const NN = String(INSTANCE).padStart(2, "0");
const host = studioHost("aria", INSTANCE);
const STORAGE_BASE = "netcomposer.aria.v1";
const STORAGE_KEY = host?.storageKey?.(STORAGE_BASE) ?? STORAGE_BASE;
const HIDDEN_KEY = `${STORAGE_KEY}.hidden`;
const PHONE = "(max-width: 768px)"; // ui-guard: allow the kit's phone breakpoint (as nc-ui PAGE_MENU_PHONE)

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function load(): AriaState {
  try {
    const raw = store()?.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}
let state = load();
function save(): void {
  try {
    store()?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: settings live for this visit */
  }
}

/** The SeedLink server: EarthScope's, or (tests, local checks) `?sl=` / localStorage `netcomposer.aria.sl`. */
function seedlinkUrl(): string {
  try {
    const q = new URLSearchParams(location.search).get("sl");
    if (q && /^wss?:\/\//.test(q)) return q;
    const s = store()?.getItem("netcomposer.aria.sl");
    if (s && /^wss?:\/\//.test(s)) return s;
  } catch {
    /* default */
  }
  return "wss://rtserve.earthscope.org/seedlink";
}
const RECORDING_URL = new URL(`${import.meta.env.BASE_URL}${RECORDING.file}`, location.href).href;

// ------------------------------------------------------------------------------------------------- DOM helpers

type Attrs = Record<string, string | undefined>;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | false)[]
) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, v);
  for (const c of children) if (c !== null && c !== false) el.append(c);
  return el;
}
const help = (key: string): Attrs => ({ [HELP_ATTR]: helpFor(key) || undefined });
function button(text: string, attrs: Attrs, onClick: () => void): HTMLButtonElement {
  const b = h("button", { type: "button", ...attrs }, text);
  b.addEventListener("click", onClick);
  return b;
}
const label = (text: string, key?: string, forId?: string) =>
  h(
    forId ? "label" : "span",
    { class: "nc-label", ...(forId ? { for: forId } : {}), ...(key ? help(key) : {}) },
    text,
  );
const fmtAge = (sec: number | null) =>
  sec === null
    ? ""
    : sec < 90
      ? `${Math.round(sec)} s`
      : sec < 5400
        ? `${Math.round(sec / 60)} min`
        : `${(sec / 3600).toFixed(1)} h`;

// ------------------------------------------------------------------------------------------------- the worker

const worker: Worker = new AriaWorker();
const toWorker = (m: ToWorker) => worker.postMessage(m);

let status: WorkerStatus = {
  type: "status",
  state: "off",
  station: null,
  newestAgeSec: null,
  behindSec: null,
  recorded: false,
  note: "",
};
let energy: number | null = null;
const energyHistory: number[] = [];
let overview: Extract<FromWorker, { type: "overview" }> | null = null;
let table: Float32Array | null = null;

/**
 * ARIA connects only when it is needed (EarthScope's server is shared): when its tab is first on screen, or when an
 * instrument asks for its signals; standalone at once. Then it stays connected for the visit.
 */
let awake = false;
function wake(): void {
  if (awake) return;
  awake = true;
  startStation();
}
function startStation(): void {
  if (!awake) return;
  if (state.station === "recording") {
    toWorker({ type: "recording", recordingUrl: RECORDING_URL });
    return;
  }
  const preset = PRESETS.find((p) => p.id === state.station);
  const spec =
    preset ??
    (() => {
      const c = parseChannel(state.custom);
      return c ? { ...c, name: `${c.net}.${c.sta}` } : null;
    })();
  if (!spec) {
    toWorker({ type: "recording", recordingUrl: RECORDING_URL });
    return;
  }
  toWorker({
    type: "start",
    station: { ...spec, name: spec.name },
    url: seedlinkUrl(),
    recordingUrl: RECORDING_URL,
  });
}

// ------------------------------------------------------------------------------------------------- the bus

const SOURCE_ID = host?.instance ?? `aria#${INSTANCE}`;
const source: StudioSituationSource | null = host?.situationSource?.(`ARIA ${INSTANCE}`) ?? null;
const ctxNow = (): number => (host?.ctx ? host.ctx.currentTime : performance.now() / 1000);
function send(m: SituationMessage): void {
  try {
    source?.send(m);
  } catch {
    /* the bus is the Studio's: a failure there must not stop ARIA */
  }
}
function demandSpeeds(): TableSpeed[] {
  return source?.demand().speeds ?? [];
}
source?.onDemand(() => {
  toWorker({ type: "speeds", speeds: demandSpeeds() });
  if ((source?.demand().receivers ?? 0) > 0) wake();
  paintTo();
});
function statusMessage(): SituationMessage {
  const st = status.station;
  return {
    v: 1,
    kind: "status",
    source: source?.id ?? SOURCE_ID,
    state: status.state,
    station: st
      ? { net: st.net, sta: st.sta, loc: st.loc, cha: st.cha, name: st.name, rate: st.rate }
      : null,
    newestAgeSec: status.newestAgeSec,
    behindSec: status.behindSec,
    ...(status.retryAt ? { retryAt: status.retryAt } : {}),
    hold: state.hold,
    credit: credit(st?.net ?? "IU"),
    ...(status.recorded ? { recorded: true } : {}),
  };
}

let lastEnergySent = 0;
worker.onmessage = (e: MessageEvent<FromWorker>) => {
  const m = e.data;
  const id = source?.id ?? SOURCE_ID;
  if (m.type === "tables") {
    for (const t of m.tables) {
      if (t.speed === 1) table = t.samples;
      if (!state.hold)
        send(
          tableMessage(id, {
            seq: t.seq,
            at: ctxNow(),
            speed: t.speed,
            station: stationOf(),
            behindSec: t.behindSec,
            samples: t.samples,
            rms: t.rms,
          }),
        );
    }
    drawTable();
  } else if (m.type === "energy") {
    energy = m.value;
    const now = performance.now();
    if (!state.hold && now - lastEnergySent >= 100) {
      lastEnergySent = now;
      send(energyMessage(id, [{ at: ctxNow() + 0.1, value: m.value }]));
    }
  } else if (m.type === "overview") {
    overview = m;
    if (energy !== null) {
      energyHistory.push(energy);
      if (energyHistory.length > 600) energyHistory.shift();
    }
    drawWave();
    drawEnergy();
  } else if (m.type === "status") {
    status = m;
    send(statusMessage());
    paintStatus();
  }
};
function stationOf() {
  const st = status.station;
  return st
    ? { net: st.net, sta: st.sta, loc: st.loc, cha: st.cha, name: st.name, rate: st.rate }
    : null;
}

// ------------------------------------------------------------------------------------------------- page

const app = document.getElementById("app") as HTMLElement;
app.classList.add("nc", "nc-page");
installHelpTips();

function apply(next: AriaState, restart: boolean): void {
  const holdChanged = next.hold !== state.hold;
  state = next;
  save();
  toWorker({ type: "smoothing", sec: state.smoothing });
  toWorker({ type: "hold", on: state.hold });
  if (holdChanged) send(state.hold ? offMessage(source?.id ?? SOURCE_ID, "hold") : statusMessage());
  if (restart) startStation();
  paint();
}

function download(): void {
  const blob = new Blob([JSON.stringify(presetFile(state), null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `aria-${NN}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileIn = h("input", { type: "file", accept: ".json,application/json" });
fileIn.hidden = true;
fileIn.addEventListener("change", async () => {
  const file = fileIn.files?.[0];
  fileIn.value = "";
  if (!file || file.size > 64 * 1024) return;
  try {
    const next = readPreset(JSON.parse(await file.text()));
    if (next) apply(next, true);
  } catch {
    /* not an ARIA file */
  }
});
const action = (text: string, run: () => void, key: string) =>
  button(text, { class: "nc-page-action", "data-aria-action": key, ...help(`page:${key}`) }, run);
const holdButton = action("Hold", () => apply({ ...state, hold: !state.hold }, false), "hold");
const headerMenu = pageMenu({
  panel: h(
    "div",
    {},
    action("Save", download, "save"),
    action("Load", () => fileIn.click(), "load"),
  ),
});
const header = h(
  "header",
  { class: "nc-page-hd" },
  h(
    "div",
    {},
    h(
      "h1",
      { class: "nc-page-title" },
      h("span", { class: "aria-brand" }, "ARIA"),
      " ",
      h("span", { class: "nc-page-sep" }, "/"),
      " SITUATION ",
      h("span", { class: "nc-page-sep" }, "/"),
      " ",
      h("span", { class: "nc-mono" }, NN),
    ),
    h("p", { class: "nc-page-sub" }, "A NetComposer element."),
  ),
  h("div", { class: "nc-page-actions" }, holdButton, headerMenu.panel, headerMenu.button, fileIn),
);
const stack = h("div", { class: "nc-stack aria-stack", "data-nc-layout": "adjacent" });
const creditEl = h(
  "span",
  { class: "aria-credit", "data-aria": "credit", title: EARTHSCOPE_ACK },
  credit("IU"),
);
const footer = h(
  "footer",
  { class: "aria-foot" },
  creditEl,
  h("span", {}, `netcomposer.situation.${NN}`),
);
app.append(header, h("main", { class: "nc-page-body" }, stack), footer);

function kitModule(id: string, title: string, summary: () => string) {
  const mount = h("div", { class: "aria-body", "data-aria-module": id });
  const def = () => ({
    id,
    title,
    summary: summary(),
    controls: [{ type: "label" as const, id: `${id}-mount`, text: "" }],
  });
  const handle = defineModule(def(), HIDDEN_KEY);
  const place = () => {
    const anchor = handle.el.querySelector(`[data-nc-id="${id}-mount"]`);
    if (anchor && anchor.nextSibling !== mount) anchor.after(mount);
  };
  place();
  return {
    handle,
    mount,
    update() {
      handle.update(def());
      place();
    },
  };
}

const stationName = () =>
  state.station === "recording"
    ? RECORDING.name
    : (PRESETS.find((p) => p.id === state.station)?.name ?? state.custom.toUpperCase());
const stationMod = kitModule("station", "Station", () => `${stationName()} · ${status.state}`);
const signalsMod = kitModule("signals", "Signals", () =>
  energy === null ? "Energy —" : `Energy ${energy.toFixed(2)}`,
);

// --- Station
const stationSelect = h("select", {
  class: "nc-select",
  id: "aria-station",
  "data-aria-id": "station",
});
for (const p of PRESETS)
  stationSelect.append(h("option", { value: p.id }, p.note ? `${p.name} · ${p.note}` : p.name));
stationSelect.append(
  h("option", { value: "custom" }, "Other station…"),
  h("option", { value: "recording" }, RECORDING.name),
);
stationSelect.addEventListener("change", () =>
  apply({ ...state, station: stationSelect.value }, true),
);
const customIn = h("input", {
  class: "nc-field-input aria-custom",
  id: "aria-custom",
  type: "text",
  spellcheck: "false",
  autocomplete: "off",
  placeholder: "NET STA LOC CHA",
  "data-aria-id": "custom",
  ...help("custom"),
});
customIn.addEventListener("change", () => {
  if (parseChannel(customIn.value))
    apply({ ...state, custom: customIn.value.trim().toUpperCase() }, true);
});
const codeEl = h("span", { class: "nc-mono aria-small aria-sub", "data-aria": "code" });
const statusEl = h("div", {
  class: "aria-status",
  role: "status",
  "data-aria": "status",
  ...help("status"),
});
const noteEl = h("p", { class: "aria-small aria-sub aria-mono", "data-aria": "note" });
const waveCanvas = h("canvas", { class: "aria-wave", "data-aria": "wave", ...help("wave") });
stationMod.mount.append(
  h(
    "div",
    { class: "aria-field" },
    h("div", { class: "aria-row-between" }, label("Station", "station", "aria-station"), codeEl),
    stationSelect,
  ),
  h(
    "div",
    { class: "aria-field", "data-aria": "custom-row" },
    label("Network station location channel", "custom", "aria-custom"),
    customIn,
  ),
  statusEl,
  noteEl,
  h(
    "div",
    { class: "aria-field" },
    waveCanvas,
    h(
      "div",
      { class: "aria-row-between aria-small aria-sub aria-mono" },
      h("span", {}, "−10 min"),
      h("span", {}, "the line is where ARIA plays · the shaded slice is the table"),
      h("span", {}, "now"),
    ),
  ),
  h("p", { class: "aria-small aria-sub aria-mono" }, "More sources later."),
);

// --- Signals
const tableCanvas = h("canvas", { class: "aria-cycle", "data-aria": "table", ...help("table") });
const toEl = h("span", { class: "aria-small aria-sub aria-mono", "data-aria": "to" });
const energyVal = h("span", { class: "aria-energy-val", "data-aria": "energy" }, "—");
const meterFill = h("i", {});
const meter = h(
  "div",
  {
    class: "aria-meter",
    role: "meter",
    "aria-label": "Energy",
    "aria-valuemin": "0",
    "aria-valuemax": "1",
    "data-aria": "meter",
  },
  meterFill,
);
const energyCanvas = h("canvas", { class: "aria-history", "data-aria": "history" });
const smoothing = createSlider({
  id: "aria-smoothing",
  label: "Smoothing",
  min: SMOOTHING_MIN,
  max: SMOOTHING_MAX,
  step: 0.1,
  value: state.smoothing,
  taper: "time",
  format: (v) => `${v.toFixed(1)} s`,
  onInput: (v) => apply({ ...state, smoothing: Math.round(v * 10) / 10 }, false),
});
smoothing.el.setAttribute(HELP_ATTR, helpFor("smoothing"));
signalsMod.mount.append(
  h(
    "div",
    { class: "aria-field" },
    h("div", { class: "aria-row-between" }, label("Ground table", "table"), toEl),
    tableCanvas,
    h(
      "div",
      { class: "aria-row-between aria-small aria-sub aria-mono" },
      h("span", {}, "256 samples · mirrored"),
      h("span", {}, "5 shapes a second"),
    ),
  ),
  h(
    "div",
    { class: "aria-field" },
    h("div", { class: "aria-row-between" }, label("Energy", "energy"), energyVal),
    meter,
    energyCanvas,
    h(
      "div",
      { class: "aria-row-between aria-small aria-sub aria-mono" },
      h("span", {}, "−10 min"),
      h("span", {}, "now"),
    ),
  ),
  smoothing.el,
  h(
    "p",
    { class: "aria-small aria-sub aria-mono" },
    "Runs whether the Studio is playing or stopped.",
  ),
);

placeModules(stack, [stationMod.handle, signalsMod.handle], "adjacent");

// ------------------------------------------------------------------------------------------------- paint

function paintStatus(): void {
  const s = status;
  const word = s.recorded && s.state !== "live" ? "RECORDED" : s.state.toUpperCase();
  const parts: (string | Node)[] = [
    h(
      "span",
      { class: `aria-word aria-${s.state}`, "data-state": s.state },
      h("i", { class: "aria-dot" }),
      word,
    ),
  ];
  if (s.station?.rate) parts.push(h("span", { class: "aria-sub" }, `${s.station.rate} samples/s`));
  if (s.newestAgeSec !== null) parts.push(h("span", {}, `newest ${fmtAge(s.newestAgeSec)} ago`));
  if (s.behindSec !== null)
    parts.push(h("span", { "data-aria": "behind" }, `playing ${fmtAge(s.behindSec)} behind now`));
  if (s.state === "offline" && s.retryAt)
    parts.push(
      h(
        "span",
        { class: "aria-sub" },
        `retry ${fmtAge(Math.max(0, (s.retryAt - Date.now()) / 1000))}`,
      ),
    );
  statusEl.replaceChildren(...parts);
  noteEl.textContent = s.note;
  noteEl.hidden = !s.note;
  codeEl.textContent = s.station
    ? [s.station.net, s.station.sta, s.station.loc, s.station.cha].join(".")
    : "";
  creditEl.textContent = credit(s.station?.net ?? "IU");
  stationMod.update();
}
function paintTo(): void {
  const d = source?.demand();
  toEl.textContent = d?.names.length
    ? `to ${d.names.join(", ")}`
    : host
      ? "no instrument listens yet"
      : "standalone";
}
function paint(): void {
  stationSelect.value = state.station;
  customIn.value = state.custom;
  (app.querySelector('[data-aria="custom-row"]') as HTMLElement).hidden =
    state.station !== "custom";
  holdButton.setAttribute("aria-pressed", String(state.hold));
  holdButton.classList.toggle("aria-held", state.hold);
  smoothing.set(state.smoothing);
  paintStatus();
  paintTo();
}

// --- canvases (drawn only while the page shows: a hidden tab's frame has no size, and a hidden document is skipped)
const css = (name: string) => getComputedStyle(app).getPropertyValue(name).trim();
function prep(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (document.visibilityState === "hidden") return null;
  const r = c.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(r.width * dpr);
  const hh = Math.round(r.height * dpr);
  if (c.width !== w || c.height !== hh) {
    c.width = w;
    c.height = hh;
  }
  const g = c.getContext("2d");
  g?.clearRect(0, 0, w, hh);
  return g;
}
function drawWave(): void {
  const g = prep(waveCanvas);
  if (!g || !overview) return;
  const { width: w, height: hh } = waveCanvas;
  const n = overview.min.length;
  g.fillStyle = css("--nc-ui-divider");
  for (let k = 1; k < 5; k++) g.fillRect(Math.round((k * w) / 5), 0, 1, hh);
  if (Number.isFinite(overview.playhead)) {
    const x = overview.playhead * w;
    g.globalAlpha = 0.14;
    g.fillStyle = css("--aria-magma");
    g.fillRect(x - overview.window * w, 0, Math.max(1, overview.window * w), hh);
    g.globalAlpha = 1;
  }
  g.fillStyle = css("--aria-magma");
  for (let i = 0; i < n; i++) {
    const x = Math.floor((i / n) * w);
    const y0 = hh / 2 - overview.max[i]! * (hh / 2 - 2);
    const y1 = hh / 2 - overview.min[i]! * (hh / 2 - 2);
    g.fillRect(x, y0, Math.max(1, Math.ceil(w / n)), Math.max(1, y1 - y0));
  }
  if (Number.isFinite(overview.playhead)) {
    g.fillStyle = css("--nc-ui-accent");
    g.fillRect(Math.round(overview.playhead * w) - 1, 0, 2, hh);
  }
}
function drawTable(): void {
  const g = prep(tableCanvas);
  if (!g || !table) return;
  const { width: w, height: hh } = tableCanvas;
  g.fillStyle = css("--nc-ui-divider");
  g.fillRect(0, Math.round(hh / 2), w, 1);
  g.strokeStyle = css("--aria-magma");
  g.lineWidth = 1.5 * (window.devicePixelRatio || 1);
  g.beginPath();
  for (let i = 0; i < table.length; i += 4) {
    const x = (i / table.length) * w;
    const y = hh / 2 - table[i]! * (hh / 2 - 3);
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.stroke();
}
function drawEnergy(): void {
  energyVal.textContent = energy === null ? "—" : energy.toFixed(2);
  meterFill.style.width = `${Math.round((energy ?? 0) * 100)}%`;
  meter.setAttribute("aria-valuenow", energy === null ? "0" : energy.toFixed(2));
  signalsMod.update();
  const g = prep(energyCanvas);
  if (!g) return;
  const { width: w, height: hh } = energyCanvas;
  g.fillStyle = css("--nc-ui-divider");
  g.fillRect(0, Math.round(hh / 2), w, 1);
  if (!energyHistory.length) return;
  g.beginPath();
  energyHistory.forEach((v, i) => {
    const x = ((600 - energyHistory.length + i) / 599) * w;
    const y = hh - v * hh;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  });
  g.strokeStyle = css("--aria-magma");
  g.lineWidth = 1.5 * (window.devicePixelRatio || 1);
  g.stroke();
}
window.addEventListener("resize", () => {
  drawWave();
  drawTable();
  drawEnergy();
});

// ------------------------------------------------------------------------------------------------- Studio preset, start

host?.providePreset?.({
  format: "netcomposer.aria",
  version: 1,
  get: () => presetFile(state),
  set: (data) => {
    const next = readPreset(data);
    if (next) apply(next, next.station !== state.station || next.custom !== state.custom);
  },
});
window.addEventListener("pagehide", () => {
  send(offMessage(source?.id ?? SOURCE_ID, "removed"));
  toWorker({ type: "stop" });
});
if (window.matchMedia(PHONE).matches) app.dataset.ariaPhone = "";
toWorker({ type: "smoothing", sec: state.smoothing });
toWorker({ type: "hold", on: state.hold });
toWorker({ type: "speeds", speeds: demandSpeeds() });
paint();
if (!host || (source?.demand().receivers ?? 0) > 0) wake();
else {
  // In the Studio a hidden tab's frame has no size: wake once the page is on screen.
  const onScreen = setInterval(() => {
    if (document.visibilityState === "visible" && app.getBoundingClientRect().width > 0) {
      clearInterval(onScreen);
      wake();
    }
  }, 1000);
}
