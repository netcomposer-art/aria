# nc-ui

nc-ui was created by [Peter Semmelhack](https://psem.me/).

> "This becomes a design language that everything uses to stay in sync with respect to UI... if we decide we want to change the font or the colors system wide, we do it in one place and all modules reference it."

nc-ui is the NetComposer design language: one set of **design tokens** (colours, fonts, type sizes, spacing, module shading, motion) that every NetComposer app and module reads. ASTRID, Rhythm, nc-clock and future modules all use it. `tokens/tokens.json` is the only place a font family, colour or size is defined: change a value there, run the build, and every module follows.

- **Three tiers.** *Base* tokens are raw values (palette, type scale, spacing scale, radii, durations). *Semantic* tokens name generic roles every app has (`module-bg-stack-2`, `readout-size`, `accent`, `label-on-fill-dark`). *Component* tokens name roles that belong to one domain, such as `--nc-synth-keybed-height` or `--nc-meaning-tension`. A module reads semantic tokens plus its own domain's component tokens, and never base tokens.
- **One source, three outputs.** `tokens.json` is compiled into `tokens.css` (CSS custom properties), a typed `tokens.ts` / `tokens.js` (for canvas, SVG and anything that can't read CSS), and `tokens.resolved.json`.
- **Runtime tokens.** The surprise fill: a random bright slot colour and the label colour that stays readable on it, computed by pure functions (`surpriseColor`, `labelColorFor`).
- **The module kit.** Since 0.2.0 nc-ui is also the one shared UI kit for every module in every NetComposer instrument: the module card and header, a real on/off switch, the label style, the slider factory, the FX card, confirm and toast. It came from Rhythm (ASTRID-Rhythm `3001e7c`), and fx-blocks' header and switch were added to it.
- **No runtime dependencies.** The token build runs on plain Node ≥ 20. The dist build and the component tests use two pinned devDependencies (esbuild, linkedom).

Status: **0.2.0, not published.** Apps vendor `dist/` at a pinned commit. Tokens were extracted from ASTRID (psemmelhack/NetComposer-Synth) with a pixel-identical result. See [docs/token-inventory.md](docs/token-inventory.md) and the draft [docs/design-rules.md](docs/design-rules.md).

## Use

CSS (once, at the root of the app):

```css
@import '@netcomposer/nc-ui/tokens.css';

.my-module { background: var(--nc-ui-module-bg-adjacent-1); padding: var(--nc-ui-module-pad); }
.my-label  { font-size: var(--nc-ui-label-size); letter-spacing: var(--nc-ui-label-tracking); color: var(--nc-ui-text-sub); }
```

JS / TS (canvas, SVG attributes, charts, maps):

```js
import { semantic as nc, component, cssVar, componentVar } from '@netcomposer/nc-ui/tokens';
ctx.strokeStyle = nc.accent;                          // '#003153'
path.setAttribute('stroke', nc['filter-lowpass']);            // shared filter curve
el.style.color = cssVar('text-sub');                  // 'var(--nc-ui-text-sub)'
el.style.height = `var(${componentVar('synth', 'keybed-height')})`; // --nc-synth-keybed-height
```

The surprise fill:

```js
import { surpriseColor, slotColors, surpriseFillStyle } from '@netcomposer/nc-ui/color';
const fill = surpriseColor(previousFill);    // HSL s 85–100 %, l 50–60 %, ≥ 60° from the last hue
const { ink, on, onInk } = slotColors(fill); // label is #242424 (ink) or white, ≥ 4.5:1
Object.assign(slots.style, surpriseFillStyle(fill)); // sets --nc-ui-surprise-*
```

## Dark mode

`tokens.json` has a `dark` set: the same names as the light tiers (`base.color.paper`, `semantic.toast-bg`, `component.synth.key-black`), each replacing one light value; everything that refers to a replaced token follows it. `tokens.css` declares the changed properties (plus `color-scheme: dark`) twice: under `:root[data-nc-theme="dark"]`, and under `@media (prefers-color-scheme: dark)` for `:root:not([data-nc-theme="light"])`. So a page follows the system by default, and `data-nc-theme="light"` or `"dark"` on `<html>` forces a theme.

```js
import { applyTheme, currentTheme, onThemeChange, followHostTheme, themeTokens, VELOCITY_RAMPS, velocityFill } from '@netcomposer/nc-ui';
followHostTheme();                       // in a Studio iframe: take the host's choice before first paint
applyTheme('dark');                      // 'system' | 'light' | 'dark' (the Studio stores it as netcomposer.studio.theme.v1)
onThemeChange((theme) => redraw());      // attribute or system change: canvas code re-reads its colours here
velocityFill(0.5, VELOCITY_RAMPS[currentTheme()]);
themeTokens('dark').semantic.accent;     // '#69A7D3'
```

CSS needs nothing: `var(--nc-ui-*)` already follows. Canvas code that reads colours with `readLive` or `getComputedStyle` only has to repaint on `onThemeChange`; code that reads the static `semantic` object should read `themeTokens(currentTheme())` instead.

## Skins and filled panels

A **skin** is a colour scheme on top of light and dark (Peter, 2026-11-19): Prussian (the default), Graphite, Oxide,
Steel and Verdigris. A skin changes only the greys' tint and the accent; the instruments' identity colours never
change. `data-nc-skin="<id>"` on `<html>` picks one (no attribute: the default). **Filled panels** are an option over
any skin: `data-nc-fill` on `<html>` raises each module as a card on a darker ground, fills empty steps, and washes
each console strip in the colour the host sets on it (`--nc-strip-identity`, the Studio's instrument colours).

```js
import { applyLook, currentSkin, fillOn, SKINS, themeTokens, velocityRamp } from '@netcomposer/nc-ui';
applyLook({ skin: 'oxide', fill: true });  // the Studio stores them as netcomposer.studio.skin.v1 / .fill.v1
SKINS;                                     // [{ id, name, about, default?, swatch: { light, dark: { paper, surf, accent } } }]
themeTokens('dark').color.accent;          // in the document's skin
velocityRamp('light', currentSkin());      // the step-fill ramp in a skin
```

`followHostTheme()` takes the host's skin and panels too, and `onThemeChange` also fires when the skin changes, so
canvas code that repaints there follows a skin with no change.

### Add a skin (one file, then build and test)

1. Write `tokens/skins/<id>.json` (the id is lowercase, the file name):
   ```json
   {
     "id": "dusk",
     "name": "Dusk",
     "about": "Blue-grey dusk with a deep indigo accent.",
     "light": { "tint": { "hue": 260, "chroma": 0.012 }, "accent": "#2B3A6B" },
     "dark":  { "tint": { "hue": 260, "chroma": 0.014 }, "accent": "#9AA8E0" }
   }
   ```
   `tint` is an OKLCH hue (0-360) and a small chroma (0-0.03; 0 is pure grey). `accent` is the colour for on,
   selected, focus and the step fills, one per theme.
2. `npm run build`: every grey listed in `tokens.json` `skin.tint` keeps its lightness and takes the tint (so the
   ladder of module, strip and divider greys keeps its spacing and contrast); the accent's companions keep their own
   lightness in the new hue. A grey that would read as green loses tint until it does not.
3. `npm test`: `test/skins.test.mjs` fails if the skin moves an instrument colour, uses green (the accent must stay
   out of hue 60-180°), or drops below 7:1 for text, 4.5:1 for sub text, the accent on the page, the page colour on
   the accent, and the step mark on every velocity fill.
4. Any new accent needs Peter's OK (AGENTS.md). Pickers list `SKINS`, so a new skin shows up with no app change once
   nc-ui is published at /nc-ui/ and the app re-vendors.

## Tokens are the source of truth (S2)

**Decision (nc-ui 0.2.0):** `tokens/tokens.json` is the only place a value lives. Tailwind and every other styling layer may **reference** tokens, and nothing else:

- Tailwind v3: `presets: [require("@netcomposer/nc-ui/tailwind-preset")]` gives `bg-nc-accent`, `text-nc-text-sub`, `p-nc-module-pad`, `gap-nc-module-gap`, `min-h-nc-target-min` and so on. Every value is `var(--nc-ui-*)`.
- Tailwind v4: `@import "@netcomposer/nc-ui/tailwind-theme.css";` after tailwindcss. It's an `@theme inline` block with the same mapping.
- Don't put a literal in a Tailwind class or config (`py-10`, `text-[11px]`, `#hex`) where a token exists. Use the token's utility, or `p-[var(--nc-ui-module-pad)]`.

Measured on live Synth: when the kit's token padding and Tailwind's `py-10` both set a module's padding, the token wins, because Tailwind's utilities sit in `@layer utilities` and the kit sheet is unlayered. This works today, but it's a collision, so migrations remove the Tailwind spacing rather than rely on it.

## The kit

There are three ways in. Each works without the others.

| Entry | What you get | Costs |
|---|---|---|
| `@netcomposer/nc-ui/nc-ui.css` (`dist/nc-ui.css`, or `nc-ui.min.css`) | Static CSS: tokens + kit sheet + confirm. Every kit class works with **no JS**. Write the markup yourself (`section.nc.nc-module`, `.nc-field[data-nc-slider]`, `button.nc-ui-switch[role=switch]` …). | CSS: 9,410 B min+gz |
| `@netcomposer/nc-ui/inject` (`dist/nc-ui-inject.min.js`) | **JS-injected CSS**, the way Rhythm does it: link `tokens.css` (3,711 B gz), then call `installTheme()`. It adds the kit sheet as one `<style data-nc-kit>`, once per document. Use this when the app's CSS budget is tight (Synth): the kit costs JS bytes, not CSS bytes. `defineModule` calls it for you. | JS: 12,053 B min+gz |
| `@netcomposer/nc-ui` (`src/index.js`, or the `dist/nc-ui.min.js` bundle) | The JS components. ESM, `sideEffects: ["*.css"]`, so a bundler keeps only what you import: `createSwitch` alone is 438 B gz and `createSlider` alone is 668 B gz. Neither pulls in the kit sheet. You can also import from the subpaths `@netcomposer/nc-ui/switch` and `/slider`. | only what you import |

Components:

- `defineModule(def)`: the module card (`section.nc.nc-module`, shaded by `module-bg-adjacent-n` / `module-bg-stack-n`) with its header (`.nc-module-hd`, at least `target-min` high) and the −/+ hide. Pass `on` / `onToggle` to get a header switch; when it's off, the body dims by colour.
- `createSwitch({ checked, onChange, labelledBy })`: the one on/off switch (fx-blocks' design). It's a `<button role="switch" aria-checked>` named by its title, showing the ON/OFF word and then a 28×16 track (`switch-*` tokens). Hover takes the text to `text`. The width never changes on toggle. It's at least `target-min` both ways, and transitions use `motion-press`.
- `createSlider(spec)` / `sliderFactory`: fx-blocks' `SliderFactory` contract (`{ id, label, min, max, value, log?, format, onInput } → { el, set }`). It returns the kit's slider row (`.nc-field[data-nc-slider]`) with a `target-min` hit band on every pointer. Pass `sliderFactory` to fx-blocks' blocks.
- The `fx` control renders the kit's FX card as `.nc-ui-fx` / `.nc-ui-fx-name`; it was `.nc-fx` before, which clashed with nc-fx's own panel. With `on` it gets fx-blocks' header row (name + switch), and with `more` a "More" disclosure. With `onFold` / `folded` it folds sideways into a narrow column in a console row (its header row elsewhere). See docs/fx-fold.md.
- The `eqGraph` control: an EQ's frequency graph (response curve, band curves, draggable nodes, live spectrum), first in an EQ's FX card, which then gets a maximize button. nc-fx's `eqGraph()` builds it from a chain. See docs/eq-graph.md.
- The `levelSteps` control: a strip of steps to draw (levels by tap or drag, a long press for one step's shape, shape tabs, a playhead). Gate's strip in the Studio. See docs/level-steps.md.
- `pageMenu()`: on phones a page header's text actions (Save, Load, New, the theme) wait behind a ☰ button; Panic stays out, one tap away. See docs/page-menu.md.
- The `group` control: a collapsible run of a module's controls under a header with the More toggle's look and touch target, `aria-expanded` / `aria-controls`, closed by default, a summary beside the title while closed, and its open state remembered per browser (`GROUP_OPEN_KEY`). See docs/group.md.
- `.nc-label` / `.nc-readout`: the label style (`label-size`, `label-weight`, `label-tracking`, uppercase, `text-sub`) and the readout style.
- `confirm()`, `createToast()`, `openStepEditor()`, as before.

Rules (`npm run lint`, run in CI):

- **No green anywhere.** The accent is `--nc-ui-accent` → `#003153`.
- **Dim by colour, never opacity.** A disabled, bypassed or silent part goes to `text-sub` / `divider` at full strength. Put `data-nc-dim="true"` on a row or card to dim it.
- **44 px targets on every pointer.** Write `var(--nc-ui-target-min)`, never `44px`.
- **Shared parts use semantic tokens only**, never another instrument's `--nc-<domain>-*`.

## Develop

```sh
npm ci          # devDependencies (esbuild, linkedom), pinned
npm run build   # tokens.json → dist/tokens.* + src/tokens.ts, then dist/nc-ui.* (kit), Tailwind preset/theme
npm run lint    # lint:ui: no green, no opacity dimming, no literal 44px, no foreign domain tokens
npm test        # outputs current, lint, tokens, contrast, components (linkedom), dist and tree-shaking
npm run inventory -- --astrid ../NetComposer-Synth --base <commit>   # regenerate docs/token-inventory.md
```

Generated files are committed so consumers don't need a build step. `npm test` fails if they are stale.

## Layout

```
tokens/tokens.json        the single source (base, semantic, component domains, runtime, constants)
tokens/renames.json       old → new names for roles moved into component domains (0.1.0 pre-release)
scripts/build-tokens.mjs  compiler (plain node)
scripts/build-dist.mjs    kit build: nc-ui.css, nc-ui.min.{css,js}, nc-ui-inject.min.js, Tailwind preset/theme
scripts/lint-ui.mjs       lint:ui (CI)
scripts/inventory.mjs     ASTRID usage → token map
dist/                     generated and committed: tokens.*, nc-ui.css, nc-ui.min.*, nc-ui-inject.min.js, confirm.css, tailwind-*
src/tokens.ts             generated typed tokens for TS consumers
src/color.js              contrast + surprise-fill maths (pure)
src/module/               defineModule (module card + header)
src/primitives/           kit sheet (kit.js), controls, switch, slider factory, confirm, toast, step editor
test/                     node:test suites + ASTRID parity fixture
docs/                     design rules, token inventory, renames, domains/ (rhythm stub)
```

## Where the tooling plugs in

Historical (0.1.0, the token layer only). The module API and primitives have since landed in the kit; the lint is `scripts/lint-ui.mjs`:

| piece | goes in | reads | contract |
|---|---|---|---|
| `defineModule` API | `src/module/` (export from `src/index.js`) | `semantic` from `dist/tokens.js`; shading through `module-bg-adjacent-n` / `module-bg-stack-n` + `module-sub-stack-n` / `module-div-stack-n` | A module declares its position (adjacent index or stack depth) and gets its shading vars. It never picks a colour. |
| Control primitives (slider, select, toggle, slot row, readout) | `src/primitives/` | semantic tokens only; their own internal geometry may stay literal | No transitions on sliders; one line down to 360 px; hide (not unmount) |
| Lint | `scripts/lint-tokens.mjs` (suggested), wired into `npm test` | `dist/tokens.resolved.json` (`domains[d].scope` maps files to domains) | Fail on a colour, font-family, px font-size, em tracking, duration or opacity literal outside `tokens/`, primitives' geometry and media queries. A media-query width must equal a `breakpoint.*` value. **Module contract:** semantic + own-domain component tokens only; a base token or another domain's `--nc-<domain>-*` is an error. The inventory's contract preview shows today's count. |
| Contract test | `test/contract.test.mjs` | `semantic`, `component`, `refs`, `componentRefs`, `domains` | Every semantic token resolves to a base token, and every component token to a base or semantic token (or an allowed fixed dimension); required roles exist; no module defines its own `--nc-ui-*` or `--nc-<domain>-*`. |
| Screenshot harness | `tools/screenshot/` | a consumer build | Desktop 1440, iPhone 390 and 360; deterministic (seeded `Math.random`, service worker bypassed); pixel diff against a baseline. The harness used for the ASTRID extraction is a starting point. |

## Credit

MIT licensed. If you fork or redistribute nc-ui, keep the credit line "nc-ui was created by Peter Semmelhack (https://psem.me/)" (see [NOTICE](NOTICE)).
