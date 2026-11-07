// nc-ui step editor: the long-press sheet for one step's velocity and probability.
// Framework-free DOM. Placement reuses the toast's anchorToastPosition; sliders use the kit's .nc-range;
// the outside-tap catcher reuses .nc-slot-scrim. Styles: the .nc-step-editor rules in kit.js.
import { base } from "../../dist/tokens.js";
import { anchorToastPosition } from "./toast.js";

/** "80%" for 0.8. Velocity and probability both read as whole percents. */
export function percent(value) {
  return `${Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * 100)}%`;
}

/**
 * Open the editor for one step. Returns { el, close() }.
 * @param {object} p
 * @param {Element} p.anchor  the step or pad that was held; the editor sits under it (a bottom sheet on phones)
 * @param {string} p.title  e.g. "Kick · step 5"
 * @param {number} p.velocity  0..1
 * @param {number} p.probability  0..1 (1 is certain)
 * @param {(next: {velocity: number, probability: number}) => void} p.onChange  on every slider move
 * @param {() => void} [p.onClose]
 */
export function openStepEditor({
  anchor,
  title,
  velocity,
  probability,
  onChange,
  onClose,
  host,
  document: doc = globalThis.document,
}) {
  host = host ?? doc.body;
  const win = doc.defaultView ?? globalThis;
  const state = { velocity, probability };
  const scrim = doc.createElement("div");
  scrim.className = "nc-slot-scrim nc-step-editor-scrim";
  const el = doc.createElement("div");
  el.className = "nc-step-editor";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", title);
  const head = doc.createElement("div");
  head.className = "nc-step-editor-head";
  const name = doc.createElement("span");
  name.className = "nc-label";
  name.textContent = title;
  const done = doc.createElement("button");
  done.type = "button";
  done.className = "nc-step-editor-done";
  done.textContent = "Done";
  head.append(name, done);
  el.appendChild(head);
  const inputs = [];
  for (const [key, label] of [
    ["velocity", "Velocity"],
    ["probability", "Chance"],
  ]) {
    const row = doc.createElement("label");
    row.className = "nc-step-editor-row";
    const text = doc.createElement("span");
    text.className = "nc-label";
    text.textContent = label;
    const input = doc.createElement("input");
    input.type = "range";
    input.className = "nc-range";
    input.min = key === "velocity" ? "0.05" : "0";
    input.max = "1";
    input.step = "0.05";
    input.value = String(state[key]);
    input.setAttribute("data-nc-edit", key);
    const out = doc.createElement("output");
    out.className = "nc-readout";
    out.textContent = percent(state[key]);
    input.setAttribute("aria-valuetext", out.textContent);
    input.addEventListener("input", () => {
      state[key] = Number(input.value);
      out.textContent = percent(state[key]);
      input.setAttribute("aria-valuetext", out.textContent);
      onChange({ velocity: state.velocity, probability: state.probability });
    });
    row.append(text, input, out);
    el.appendChild(row);
    inputs.push(input);
  }
  host.append(scrim, el);
  // Mark the held step (a dark ring in the kit); the mark leaves with the editor.
  anchor?.setAttribute?.("data-editing", "true");

  const phone = win.matchMedia?.(`(max-width: ${base.breakpoint.md})`).matches ?? false;
  if (phone) {
    el.setAttribute("data-placement", "sheet");
    scrim.setAttribute("data-placement", "sheet");
  } else {
    const a = anchor?.getBoundingClientRect?.();
    const own = el.getBoundingClientRect();
    const gap = Number.parseFloat(win.getComputedStyle(el).getPropertyValue("row-gap")) || 8;
    if (a) {
      let { top, left } = anchorToastPosition(
        a,
        [],
        { width: own.width, height: own.height },
        win.innerWidth,
        gap,
        gap,
      );
      if (top + own.height > win.innerHeight) top = Math.max(gap, a.top - gap - own.height);
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
    }
    el.setAttribute("data-placement", "anchor");
  }
  inputs[0]?.focus({ preventScroll: true });

  let open = true;
  const onKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };
  function close() {
    if (!open) return;
    open = false;
    doc.removeEventListener("keydown", onKey, true);
    scrim.remove();
    el.remove();
    anchor?.removeAttribute?.("data-editing");
    if (anchor?.isConnected && typeof anchor.focus === "function")
      anchor.focus({ preventScroll: true });
    onClose?.();
  }
  doc.addEventListener("keydown", onKey, true);
  scrim.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    close();
  });
  done.addEventListener("click", close);
  return { el, close };
}
