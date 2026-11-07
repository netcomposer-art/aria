// nc-ui confirm: an in-app question, never window.confirm. Self-contained: styles in confirm.css, linked once.

let open = null;
let seq = 0;
export const confirmCss = new URL("./confirm.css", import.meta.url).href;
// Links confirm.css once per document; a promise while it loads.
const styles = (doc) => {
  let link = doc.querySelector?.("link[data-nc-ui-confirm]");
  if (!link && doc.head) {
    link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = confirmCss;
    link.dataset.ncUiConfirm = "";
    link.ncWait = new Promise((r) => {
      const ready = () => {
        link.ncWait = null;
        r();
      };
      link.onload = ready;
      link.onerror = ready;
    });
    doc.head.append(link);
  }
  return link?.ncWait;
};
// At import, before the first question.
if (typeof document !== "undefined") styles(document);

/** See confirm.d.ts and docs/confirm.md. @param {import('./confirm').ConfirmOptions} opts */
export function confirm(opts) {
  return dialog(opts).then((r) => !!r.ok);
}

// ask.js: field(make, ok) gives [row, input].
export function dialog(
  { title, body, lines = [], extra, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, root, returnFocus, signal },
  field,
) {
  if (open || signal?.aborted) return Promise.resolve({});
  const doc = root?.ownerDocument ?? document;
  const wait = styles(doc);
  const host = root ?? doc.body;
  const win = doc.defaultView ?? globalThis;
  const id = `nc-ui-confirm-${++seq}`;
  const make = (tag, cls, text) => {
    const el = doc.createElement(tag);
    el.className = `nc-ui-confirm${cls}`;
    if (text != null) el.textContent = text;
    return el;
  };
  const layer = make("div", "-layer");
  layer.dataset.state = "enter";
  const box = make("div", "");
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-labelledby", `${id}-t`);

  const head = make("h2", "-title", title);
  head.id = `${id}-t`;
  const line = make("p", "-body", body);
  line.id = `${id}-b`;
  // More lines under the body (a danger one in the danger colour); all of them describe the dialog.
  const notes = lines.map((l, i) => {
    const p = make("p", "-body", l?.text ?? l);
    p.id = `${id}-b${i}`;
    if (l?.tone === "danger") p.dataset.tone = "danger";
    return p;
  });
  box.setAttribute("aria-describedby", [line, ...notes].map((p) => p.id).join(" "));
  // A third action as a text button above the two (e.g. "Save Scene first"): it runs and the dialog stays open.
  const more = extra && make("button", "-extra", extra.label);
  if (more) {
    more.type = "button";
    more.dataset.ncConfirm = "extra";
    more.addEventListener("click", () => extra.onAction?.());
  }
  const row = make("div", "-actions");
  const button = (label, value) => {
    const b = make("button", "-btn", label);
    b.type = "button";
    b.dataset.ncConfirm = value;
    b.addEventListener("click", () => done(value === "ok"));
    return b;
  };
  const cancel = button(cancelLabel, "cancel");
  const ok = button(confirmLabel, "ok");
  if (danger) ok.dataset.danger = "true";
  row.append(cancel, ok);
  const [wrap, input] = field?.(make, ok) ?? [];
  box.append(head, line, ...notes, ...(wrap ? [wrap] : []), ...(more ? [more] : []), row);
  const order = [input, more, cancel, ok].filter(Boolean);
  layer.append(box);

  const state = { layer };
  open = state;
  const back = returnFocus ?? doc.activeElement;
  const inerted = [];
  for (const el of host.children)
    if (!el.hasAttribute("inert")) {
      el.setAttribute("inert", "");
      inerted.push(el);
    }
  // Shown once confirm.css is in, so it never flashes unstyled.
  const show = () => {
    if (open !== state) return;
    host.append(layer);
    (input ?? cancel).focus({ preventScroll: true });
    const raf = win.requestAnimationFrame?.bind(win) ?? ((f) => setTimeout(f, 16));
    raf(() =>
      raf(() => {
        if (layer.dataset.state === "enter") layer.dataset.state = "open";
      }),
    );
  };
  if (wait) wait.then(show);
  else show();

  // A tap that starts and ends on the backdrop cancels (a drag out of the box does not).
  let downOnLayer = false;
  layer.addEventListener("pointerdown", (e) => {
    downOnLayer = e.target === layer;
  });
  layer.addEventListener("click", (e) => {
    if (e.target === layer && downOnLayer) done(false);
    downOnLayer = false;
  });
  // Capture on the window, so no page shortcut (Space, digits) sees a key while the dialog is open.
  const onKey = (e) => {
    e.stopImmediatePropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      done(false);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const live = order.filter((el) => !el.disabled);
      const n = live.length;
      live[(live.indexOf(doc.activeElement) + (e.shiftKey ? n - 1 : 1)) % n].focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (doc.activeElement === more) more.click();
      else if (doc.activeElement === cancel) done(false);
      else if (!ok.disabled) done(true);
    }
  };
  const mute = (e) => e.stopImmediatePropagation();
  win.addEventListener("keydown", onKey, true);
  win.addEventListener("keyup", mute, true);
  // Closed from code: false, cleaned up like Cancel.
  const onAbort = () => done(false);
  signal?.addEventListener("abort", onAbort);

  let resolve;
  const answer = new Promise((r) => {
    resolve = r;
  });
  function done(value) {
    if (open !== state) return;
    open = null;
    win.removeEventListener("keydown", onKey, true);
    win.removeEventListener("keyup", mute, true);
    signal?.removeEventListener("abort", onAbort);
    for (const el of inerted) el.removeAttribute("inert");
    layer.dataset.state = "closing";
    if (back?.isConnected && typeof back.focus === "function") back.focus({ preventScroll: true });
    const cs = win.getComputedStyle?.(layer);
    const ms = Math.max(
      0,
      ...String(cs?.transitionDuration ?? "")
        .split(",")
        .map((d) => Number.parseFloat(d) * (d.trim().endsWith("ms") ? 1 : 1000) || 0),
    );
    const gone = () => layer.remove();
    layer.addEventListener("transitionend", (e) => e.target === layer && gone());
    setTimeout(gone, ms + 50); // reduced motion (no transition) or a missed transitionend
    resolve({ ok: value, value: input?.value.trim() });
  }
  return answer;
}
