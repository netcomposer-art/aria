// nc-ui ask: the confirm dialog with one text field (confirm.js; styles in confirm.css).
import { dialog } from "./confirm.js";

/** See confirm.d.ts (ask) and docs/confirm.md. @param {import('./confirm').AskOptions} opts */
export function ask(opts) {
  const f = opts.field ?? {};
  const field = (make, ok) => {
    const wrap = make("label", "-field");
    const input = make("input", "-input");
    input.type = f.type ?? "text";
    input.value = f.value ?? "";
    if (f.placeholder) input.placeholder = f.placeholder;
    input.spellcheck = false;
    input.autocomplete = "off";
    // The action waits for some text.
    const sync = () => {
      ok.disabled = input.value.trim() === "";
    };
    input.addEventListener("input", sync);
    sync();
    wrap.append(make("span", "-label", f.label ?? ""), input);
    return [wrap, input];
  };
  return dialog(opts, field).then((r) => (r.ok ? r.value : null));
}
