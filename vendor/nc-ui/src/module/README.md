# src/module: seam for the defineModule API

Reserved for the module API (Petra). A module declares where it sits (adjacent index 1–4, or stack depth 1–4 inside a parent) and receives its shading through the semantic tokens:

- background: `module-bg-adjacent-n` / `module-bg-stack-n`
- secondary text: `module-sub-stack-n`
- dividers: `module-div-stack-n`
- padding: `module-pad*`

It never picks a colour itself. Export the public API from `src/index.js` and type it in `src/index.d.ts`.

## Sections

A module body is a list of `sections` (or one implicit section from `controls`):

- `inset: true`: a shaded panel one shade darker than the module, full bleed (ASTRID's Hacks panel).
- `panel: true`: a titled region (`role="region"`, named by `title`) under the section before it, coloured `surface-page`, full bleed to the module's sides and bottom, with a hairline above. `subject` names what it edits (tinted by `lane` 1–4), and its controls sit in three columns from 1024 px, one column on phones. When only `subject`, `lane` or values change, the panel is patched in place, so slider nodes and focus survive. Rhythm's Parameters panel under the step grid uses it: the grid's lane names pick the subject (`onSelectRow`), which replaces a separate Voice module with tabs.
