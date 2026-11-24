#!/usr/bin/env node
// Build nc-ui tokens (base, semantic, component, runtime) from tokens/tokens.json. Plain Node (>=20), no dependencies.
//   node scripts/build-tokens.mjs                 write dist/ and src/tokens.ts
//   node scripts/build-tokens.mjs --check         fail if the committed outputs are stale
//   node scripts/build-tokens.mjs --src f --out d build another source into another folder
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkins, skinColors, withColors, skinSelectors, velocityRemap } from './skins.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const check = process.argv.includes('--check');
const srcPath = resolve(arg('--src') ?? join(root, 'tokens/tokens.json'));
const outDir = resolve(arg('--out') ?? root);
const skinsDir = join(dirname(srcPath), 'skins');

export function load(path) { return JSON.parse(readFileSync(path, 'utf8')); }
const isMeta = (k) => k.startsWith('$');

/**
 * A derived colour: `{ "mix": { "ref": "{color.accent}", "pct": 12, "with": "{color.paper}" } }` (or `"with":
 * "transparent"`). CSS gets color-mix() over the referenced variables, so a live change to the accent re-tints every
 * mix; JS and canvas get the same blend computed here (sRGB, as color-mix(in srgb, ...)).
 * A base alias: `{ "ref": "{color.filter-accent}" }` keeps a renamed token's variable for older consumers; it must
 * follow its target.
 */
const hexRgb = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`mix: ${hex} is not #rrggbb`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => `#${rgb.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
function mixValue(of, pct, withValue) {
  const a = hexRgb(of);
  if (withValue === 'transparent') return `rgba(${a.join(',')},${+(pct / 100).toFixed(3)})`;
  const b = hexRgb(withValue);
  return toHex(a.map((x, i) => (x * pct + b[i] * (100 - pct)) / 100));
}
function resolveMix(where, mix, lookup) {
  const ref = /^\{([^}]+)\}$/.exec(mix.ref ?? '');
  const from = ref && lookup(ref[1]);
  if (!from) throw new Error(`${where}: unknown mix ref ${mix.ref}`);
  if (!(typeof mix.pct === 'number' && mix.pct > 0 && mix.pct < 100)) throw new Error(`${where}: mix pct must be 0-100`);
  let withValue = 'transparent', withCss = 'transparent';
  if (mix.with !== 'transparent') {
    const w = /^\{([^}]+)\}$/.exec(mix.with ?? '');
    const other = w && lookup(w[1]);
    if (!other) throw new Error(`${where}: unknown mix with ${mix.with}`);
    withValue = other.value; withCss = `var(${other.cssVar})`;
  }
  return {
    value: mixValue(from.value, mix.pct, withValue),
    css: `color-mix(in srgb, var(${from.cssVar}) ${mix.pct}%, ${withCss})`,
    mix: ref[1],
  };
}

/** Flatten tokens.json into { base, semantic, component, runtime: Map; domains; constants }. */
export function compile(src) {
  const prefix = src.prefix ?? 'nc-ui';
  const base = new Map();
  for (const [group, entries] of Object.entries(src.base)) {
    if (isMeta(group)) continue;
    for (const [name, t] of Object.entries(entries)) {
      if (isMeta(name)) continue;
      const cssVar = `--${prefix}-${group}-${name}`;
      if (t.mix) {
        const m = resolveMix(`base ${group}.${name}`, t.mix, (key) => base.get(key));
        base.set(`${group}.${name}`, { group, name, value: m.value, css: m.css, cssVar, note: t.note ?? '', format: t.format });
        continue;
      }
      if (t.ref !== undefined) {
        // A base alias (a renamed token kept for older consumers): same value, its CSS points at the target's variable.
        const m = /^\{([^}]+)\}$/.exec(t.ref);
        const to = m && base.get(m[1]);
        if (!to) throw new Error(`base ${group}.${name}: unknown ref ${t.ref} (an alias must follow its target)`);
        base.set(`${group}.${name}`, { group, name, value: to.value, css: `var(${to.cssVar})`, alias: m[1], cssVar, note: t.note ?? '', format: t.format });
        continue;
      }
      if (typeof t.value !== 'string' || t.value === '') throw new Error(`base ${group}.${name}: value must be a non-empty string`);
      base.set(`${group}.${name}`, { group, name, value: t.value, cssVar, note: t.note ?? '', format: t.format });
    }
  }
  const groups = new Set([...base.values()].map((b) => b.group));
  const resolveTier2 = (tier) => {
    const out = new Map();
    for (const [name, t] of Object.entries(src[tier] ?? {})) {
      if (isMeta(name)) continue;
      for (const g of groups) if (name.startsWith(`${g}-`)) throw new Error(`${tier} "${name}" collides with base group "${g}"`);
      let value, ref, css;
      if (t.ref !== undefined) {
        const m = /^\{([^}]+)\}$/.exec(t.ref);
        if (!m || !base.has(m[1])) throw new Error(`${tier} "${name}": unknown ref ${t.ref}`);
        ref = m[1]; value = base.get(ref).value; css = `var(${base.get(ref).cssVar})`;
      } else if (t.mix) {
        ({ value, css } = resolveMix(`${tier} "${name}"`, t.mix, (key) => base.get(key)));
      } else if (typeof t.value === 'string' && t.value) { value = t.value; css = t.value; }
      else throw new Error(`${tier} "${name}" needs a ref, a mix or a value`);
      out.set(name, { name, value, ref, css, cssVar: `--${prefix}-${name}`, role: t.role ?? '' });
    }
    return out;
  };
  const semantic = resolveTier2('semantic');
  const runtime = resolveTier2('runtime');
  for (const n of runtime.keys()) if (semantic.has(n)) throw new Error(`runtime "${n}" duplicates a semantic token`);

  // Tier 3: component tokens, namespaced by domain. --<componentPrefix>-<domain>-<name>.
  const cprefix = src.componentPrefix ?? 'nc';
  const component = new Map();
  const domains = {};
  for (const [domain, entries] of Object.entries(src.component ?? {})) {
    if (isMeta(domain)) continue;
    if (!/^[a-z][a-z0-9]*$/.test(domain)) throw new Error(`component domain "${domain}": use one lowercase word`);
    if (`${cprefix}-${domain}` === prefix || domain === 'ui') throw new Error(`component domain "${domain}" would collide with the --${prefix}-* namespace`);
    if (groups.has(domain)) throw new Error(`component domain "${domain}" collides with base group "${domain}"`);
    domains[domain] = { description: entries.$description ?? '', scope: entries.$scope ?? [] };
    for (const name of semantic.keys()) if (name === domain || name.startsWith(`${domain}-`)) throw new Error(`semantic "${name}" belongs in component domain "${domain}"`);
    for (const [name, t] of Object.entries(entries)) {
      if (isMeta(name)) continue;
      if (name.startsWith(`${domain}-`)) throw new Error(`component ${domain}.${name}: drop the repeated "${domain}-"`);
      let value, ref, css;
      if (t.ref !== undefined) {
        const m = /^\{([^}]+)\}$/.exec(t.ref);
        const key = m?.[1];
        if (key?.startsWith('semantic.') && semantic.has(key.slice(9))) { const s = semantic.get(key.slice(9)); ref = key; value = s.value; css = `var(${s.cssVar})`; }
        else if (key && base.has(key)) { ref = key; value = base.get(key).value; css = `var(${base.get(key).cssVar})`; }
        else throw new Error(`component ${domain}.${name}: unknown ref ${t.ref}`);
      } else if (typeof t.value === 'string' && t.value) { value = t.value; css = t.value; }
      else throw new Error(`component ${domain}.${name} needs a ref or a value`);
      component.set(`${domain}.${name}`, { domain, name, value, ref, css, cssVar: `--${cprefix}-${domain}-${name}`, role: t.role ?? '' });
    }
  }
  const constants = Object.fromEntries(Object.entries(src.constants ?? {}).filter(([k]) => !isMeta(k)).map(([k, v]) => [k, v.value]));
  const out = { prefix, componentPrefix: cprefix, base, semantic, component, domains, runtime, constants };
  const ds = src.dark ? darkSource(src) : null;
  if (ds) Object.defineProperty(out, 'dark', { value: compile(ds), enumerable: false });
  return out;
}

/**
 * The dark theme (tokens.json `dark`): the same shape as the light tiers (base.<group>.<name>, semantic.<name>,
 * component.<domain>.<name>), each entry replacing the light token of the same name. Returns the light source with
 * those entries swapped in (so every ref and mix follows), or null when there is no dark set.
 */
export function darkSource(src) {
  if (!src.dark) return null;
  const out = structuredClone(src);
  delete out.dark;
  const swap = (where, into, from) => {
    for (const [name, t] of Object.entries(from ?? {})) {
      if (isMeta(name)) continue;
      if (!into || !(name in into)) throw new Error(`dark ${where}${name}: no light token of that name`);
      into[name] = t;
    }
  };
  for (const [group, entries] of Object.entries(src.dark.base ?? {})) if (!isMeta(group)) swap(`base ${group}.`, out.base[group], entries);
  swap('semantic ', out.semantic, src.dark.semantic);
  for (const [domain, entries] of Object.entries(src.dark.component ?? {})) if (!isMeta(domain)) swap(`component ${domain}.`, out.component[domain], entries);
  return out;
}

/** Every custom property the CSS declares, in order: [cssVar, css]. */
function cssEntries(c) {
  return [
    ...[...c.base.values()].map((b) => [b.cssVar, b.css ?? b.value]),
    ...[...c.semantic.values()].map((s) => [s.cssVar, s.css]),
    ...[...c.component.values()].map((t) => [t.cssVar, t.css]),
    ...[...c.runtime.values()].map((s) => [s.cssVar, s.css]),
  ];
}

/** The selectors a dark value applies under: the Studio's (or a user's) explicit choice, and the system setting. */
export const DARK_SELECTOR = ':root[data-nc-theme="dark"]';
export const DARK_MEDIA = '@media (prefers-color-scheme: dark)';
export const DARK_SYSTEM_SELECTOR = ':root:not([data-nc-theme="light"])';

/** The dark blocks: only the properties whose CSS differs from the light theme. */
export function renderDarkCss(c, d) {
  if (!d) return '';
  const light = new Map(cssEntries(c));
  const changed = cssEntries(d).filter(([k, v]) => light.get(k) !== v);
  const body = (ind) => [`${ind}color-scheme: dark;`, ...changed.map(([k, v]) => `${ind}${k}: ${v};`)].join('\n');
  return [
    '/* Dark theme (tokens.json `dark`): an explicit choice, then the system setting unless light was chosen. */',
    `${DARK_SELECTOR} {`, body('  '), '}', '',
    `${DARK_MEDIA} {`, `  ${DARK_SYSTEM_SELECTOR} {`, body('    '), '  }', '}', '',
  ].join('\n');
}

/**
 * Compile every skin (tokens/skins/*.json, scripts/skins.mjs): for each, the light and dark token sets with its
 * colours swapped in. Attached to `c` as c.skins = [{ skin, light, dark, colors: { light, dark } }] (the default
 * skin has no sets: it is the tokens as they are).
 */
export function compileSkins(src, c, skins) {
  const spec = src.skin;
  const out = [];
  if (!skins.length) return out;
  if (!spec) throw new Error('tokens/skins exists but tokens.json has no `skin` section');
  const colorsOf = (k) => Object.fromEntries([...k.base.values()].filter((b) => b.group === 'color').map((b) => [b.name, b.value]));
  const light = colorsOf(c), dark = c.dark ? colorsOf(c.dark) : light;
  const lightSrc = structuredClone(src);
  delete lightSrc.dark;
  const darkSrc = src.dark ? darkSource(src) : lightSrc;
  for (const skin of skins) {
    if (skin.default) { out.push({ skin }); continue; }
    const colors = { light: skinColors(light, spec, skin.light), dark: skinColors(dark, spec, skin.dark) };
    out.push({ skin, colors, light: compile(withColors(lightSrc, colors.light)), dark: compile(withColors(darkSrc, colors.dark)) });
  }
  return out;
}

/** Each skin's blocks: only the properties it changes, under its light, system-dark and dark selectors. */
export function renderSkinCss(c) {
  const skins = (c.skins ?? []).filter((s) => !s.skin.default);
  if (!skins.length) return '';
  const lightBase = new Map(cssEntries(c));
  const darkBase = new Map(cssEntries(c.dark ?? c));
  const lines = ['/* Skins (tokens/skins/*.json): data-nc-skin="<id>" on <html>. Each block lists only what the skin changes. */'];
  for (const { skin, light, dark } of skins) {
    const l = cssEntries(light).filter(([k, v]) => lightBase.get(k) !== v);
    const lightKeys = new Set(l.map(([k]) => k));
    // The dark blocks also restate every property the light block sets, since the light selector matches under the
    // system setting too.
    const d = cssEntries(dark).filter(([k, v]) => darkBase.get(k) !== v || lightKeys.has(k));
    const sel = skinSelectors(skin.id);
    const body = (rows, ind) => rows.map(([k, v]) => `${ind}${k}: ${v};`).join('\n');
    lines.push(`/* ${skin.name}: ${skin.about ?? ''} */`, `${sel.light} {`, body(l, '  '), '}',
      `${DARK_MEDIA} {`, `  ${sel.system} {`, body(d, '    '), '  }', '}',
      `${sel.dark} {`, body(d, '  '), '}', '');
  }
  // The step and pad velocity fills: every kit version writes the default ramp's hex on the cell (data-nc-velocity),
  // so each skin re-maps it here, in the live sheet, and no app has to be rebuilt. :where() keeps this under the
  // kit's state rules (a silent row's grey fill wins). A browser without relative colours shows the default fill.
  const rampOf = (k) => { const r = [...k.component.values()].filter((t) => t.domain === 'rhythm'); const g = (n) => r.find((t) => t.name === n).value; return { min: g('velocity-min'), max: g('velocity-max') }; };
  const cell = ':is(.nc-step, .nc-pad)[aria-pressed="true"][data-nc-velocity]';
  lines.push('/* Skins: the step and pad velocity fills on each skin\'s ramp (re-mapped from the default ramp the kit writes). */');
  for (const { skin, light, dark } of skins) {
    const sel = skinSelectors(skin.id);
    const l = velocityRemap(rampOf(c), rampOf(light));
    const d = velocityRemap(rampOf(c.dark ?? c), rampOf(dark));
    const rule = (s2, v, ind) => `${ind}:where(${s2}) ${cell} { background: ${v}; border-color: ${v}; }`;
    lines.push(rule(sel.light, l, ''), `${DARK_MEDIA} {`, rule(sel.system, d, '  '), '}', rule(sel.dark, d, ''));
  }
  lines.push('');
  return lines.join('\n');
}

const HEADER = 'Generated by scripts/build-tokens.mjs from tokens/tokens.json. Do not edit by hand.\nnc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.';

export function renderCss(c) {
  const lines = [`/* ${HEADER.replace(/\n/g, '\n   ')} */`, '', ':root {', '  /* Tier 1: base values */'];
  let last = '';
  for (const b of c.base.values()) {
    if (b.group !== last) { lines.push(`  /* ${b.group} */`); last = b.group; }
    lines.push(`  ${b.cssVar}: ${b.css ?? b.value};`);
  }
  lines.push('', '  /* Tier 2: semantic roles (use these in modules) */');
  for (const s of c.semantic.values()) lines.push(`  ${s.cssVar}: ${s.css};`);
  lines.push('', '  /* Tier 3: component roles, one namespace per domain (a module uses only its own domain) */');
  for (const d of Object.keys(c.domains)) {
    const own = [...c.component.values()].filter((t) => t.domain === d);
    lines.push(`  /* ${d}${own.length ? '' : ': reserved, no tokens yet'} */`);
    for (const t of own) lines.push(`  ${t.cssVar}: ${t.css};`);
  }
  lines.push('', '  /* Runtime: defaults; code may override them on an element (see src/color.js) */');
  for (const s of c.runtime.values()) lines.push(`  ${s.cssVar}: ${s.css};`);
  lines.push('}', '');
  const d = c.dark ?? null;
  if (d) lines.push(renderDarkCss(c, d));
  const sk = renderSkinCss(c);
  if (sk) lines.push(sk);
  return lines.join('\n');
}

function nest(c) {
  const base = {};
  for (const b of c.base.values()) (base[b.group] ??= {})[b.name] = b.value;
  const obj = (m, f) => Object.fromEntries([...m.values()].map((t) => [t.name, f(t)]));
  const byDomain = (f) => Object.fromEntries(Object.keys(c.domains).map((d) =>
    [d, Object.fromEntries([...c.component.values()].filter((t) => t.domain === d).map((t) => [t.name, f(t)]))]));
  return {
    base,
    semantic: obj(c.semantic, (t) => t.value),
    component: byDomain((t) => t.value),
    componentVars: byDomain((t) => `var(${t.cssVar})`),
    componentRefs: byDomain((t) => t.ref ?? null),
    domains: c.domains,
    runtime: obj(c.runtime, (t) => t.value),
    vars: { ...obj(c.semantic, (t) => `var(${t.cssVar})`), ...obj(c.runtime, (t) => `var(${t.cssVar})`) },
    refs: obj(c.semantic, (t) => t.ref ?? null),
    constants: c.constants,
    themes: Object.fromEntries([['light', c], ...(c.dark ? [['dark', c.dark]] : [])].map(([name, t]) => [name, themeOf(t)])),
    skins: (c.skins ?? []).map(({ skin, colors }) => ({
      id: skin.id,
      name: skin.name,
      about: skin.about ?? '',
      ...(skin.default ? { default: true } : {}),
      swatch: Object.fromEntries(['light', 'dark'].map((m) => {
        const t = themeOf(m === 'dark' && c.dark ? c.dark : c).color;
        const own = colors?.[m] ?? {};
        return [m, { paper: own.paper ?? t.paper, surf: own.surf ?? t.surf, accent: own.accent ?? t.accent }];
      })),
    })),
    skinThemes: Object.fromEntries((c.skins ?? []).filter((s) => !s.skin.default).map(({ skin, light, dark }) => [skin.id, {
      light: diffTheme(themeOf(c), themeOf(light)),
      dark: diffTheme(themeOf(c.dark ?? c), themeOf(dark)),
    }])),
  };
}

/** A compiled set's resolved colours, as themes.light / themes.dark. */
function themeOf(t) {
  const obj = (m, f) => Object.fromEntries([...m.values()].map((x) => [x.name, f(x)]));
  return {
    color: Object.fromEntries([...t.base.values()].filter((b) => b.group === 'color').map((b) => [b.name, b.value])),
    semantic: obj(t.semantic, (x) => x.value),
    component: Object.fromEntries(Object.keys(t.domains).map((dm) =>
      [dm, Object.fromEntries([...t.component.values()].filter((x) => x.domain === dm).map((x) => [x.name, x.value]))])),
    runtime: obj(t.runtime, (x) => x.value),
  };
}

/** Only what differs from `from`, same shape (component by domain), empty groups dropped. */
function diffTheme(from, to) {
  const flat = (a, b) => Object.fromEntries(Object.entries(b).filter(([k, v]) => a[k] !== v));
  const out = {};
  for (const g of ['color', 'semantic', 'runtime']) { const d = flat(from[g], to[g]); if (Object.keys(d).length) out[g] = d; }
  const comp = {};
  for (const [dm, vals] of Object.entries(to.component)) { const d = flat(from.component[dm] ?? {}, vals); if (Object.keys(d).length) comp[dm] = d; }
  if (Object.keys(comp).length) out.component = comp;
  return out;
}

export function renderJs(c, { ts = false } = {}) {
  const n = nest(c);
  const asConst = ts ? ' as const' : '';
  const j = (v) => JSON.stringify(v, null, 2);
  const out = [`// ${HEADER.replace(/\n/g, '\n// ')}`, ''];
  out.push(`export const prefix = ${j(c.prefix)}${asConst};`);
  out.push(`/** Tier 1: raw values. Prefer semantic tokens in module code. */`);
  out.push(`export const base = ${j(n.base)}${asConst};`);
  out.push(`/** Tier 2: semantic roles, resolved to their values (for canvas, SVG attributes, charts). */`);
  out.push(`export const semantic = ${j(n.semantic)}${asConst};`);
  out.push(`/** Tier 3: component roles by domain, resolved (component.synth['keybed-height']). Use only your own domain. */`);
  out.push(`export const component = ${j(n.component)}${asConst};`);
  out.push(`/** var(--nc-<domain>-*) references for inline styles, by domain. */`);
  out.push(`export const componentVars = ${j(n.componentVars)}${asConst};`);
  out.push(`/** What each component token points at: "group.name" (base) or "semantic.name". */`);
  out.push(`export const componentRefs = ${j(n.componentRefs)}${asConst};`);
  out.push(`/** Component domains: what each covers and which source paths belong to it (for the lint). */`);
  out.push(`export const domains = ${j(n.domains)}${asConst};`);
  out.push(`/** Runtime tokens and their defaults. */`);
  out.push(`export const runtime = ${j(n.runtime)}${asConst};`);
  out.push(`/** var(--nc-ui-*) references for inline styles. */`);
  out.push(`export const vars = ${j(n.vars)}${asConst};`);
  out.push(`/** Which base value each semantic token points at. */`);
  out.push(`export const refs = ${j(n.refs)}${asConst};`);
  out.push(`/** Numbers used by code (contrast, Surprise colour). */`);
  out.push(`export const constants = ${j(n.constants)}${asConst};`);
  out.push(`/** Resolved colours per theme (light is the tiers above; dark is tokens.json \`dark\`), for canvas and SVG. */`);
  // Light is the tiers above (the same objects); only dark is spelled out.
  const darkJson = n.themes.dark ? `,\n  dark: ${j(n.themes.dark).replace(/\n/g, '\n  ')}` : '';
  out.push(`export const themes = {\n  light: { color: base.color, semantic, component, runtime }${darkJson}\n}${asConst};`);
  out.push(`/** Skins (tokens/skins): id, name, about and a swatch (paper, surf, accent) per theme, the default first. */`);
  out.push(`export const skins = ${j(n.skins)}${asConst};`);
  if (ts) out.push('export type SkinDiff = { color?: Record<string, string>; semantic?: Record<string, string>; component?: Record<string, Record<string, string>>; runtime?: Record<string, string> };');
  out.push(`/** What each skin changes in themes.light / themes.dark (same shape, changed values only). See src/theme.js themeTokens. */`);
  out.push(`export const skinThemes = ${JSON.stringify(n.skinThemes)}${asConst};`);
  if (ts) {
    out.push('export type SemanticToken = keyof typeof semantic;');
    out.push('export type RuntimeToken = keyof typeof runtime;');
    out.push('export type BaseGroup = keyof typeof base;');
    out.push('export type ComponentDomain = keyof typeof component;');
    out.push('export type ComponentToken<D extends ComponentDomain> = keyof (typeof component)[D];');
    out.push('export type ThemeName = keyof typeof themes;');
    out.push(`export const cssVar = (name: SemanticToken | RuntimeToken): string => \`--\${prefix}-\${name}\`;`);
    out.push(`export const componentVar = <D extends ComponentDomain>(domain: D, name: ComponentToken<D> & string): string => \`--${c.componentPrefix}-\${domain}-\${name}\`;`);
  } else {
    out.push('export const cssVar = (name) => `--${prefix}-${name}`;');
    out.push(`export const componentVar = (domain, name) => \`--${c.componentPrefix}-\${domain}-\${name}\`;`);
  }
  out.push('export default { prefix, base, semantic, component, componentVars, componentRefs, domains, runtime, vars, refs, constants, themes, skins, skinThemes, cssVar, componentVar };', '');
  return out.join('\n');
}

export function renderDts(c) {
  // The .d.ts is the typed TS module minus values: reuse the TS source's literal types.
  const n = nest(c);
  const lit = (v, ind = '') => {
    if (Array.isArray(v)) return `readonly [${v.map((x) => lit(x)).join(', ')}]`;
    if (v === null) return 'null';
    if (typeof v === 'object') return `{\n${Object.entries(v).map(([k, x]) => `${ind}  readonly ${JSON.stringify(k)}: ${lit(x, ind + '  ')};`).join('\n')}\n${ind}}`;
    return JSON.stringify(v);
  };
  return [`// ${HEADER.replace(/\n/g, '\n// ')}`, '',
    `export declare const prefix: ${lit(c.prefix)};`,
    ...['base', 'semantic', 'component', 'componentVars', 'componentRefs', 'domains', 'runtime', 'vars', 'refs', 'constants', 'themes', 'skins'].map((k) => `export declare const ${k}: ${lit(n[k])};`),
    'export type SkinDiff = { color?: Record<string, string>; semantic?: Record<string, string>; component?: Record<string, Record<string, string>>; runtime?: Record<string, string> };',
    'export declare const skinThemes: Record<string, { light: SkinDiff; dark: SkinDiff }>;',
    'export type SemanticToken = keyof typeof semantic;',
    'export type RuntimeToken = keyof typeof runtime;',
    'export type BaseGroup = keyof typeof base;',
    'export type ComponentDomain = keyof typeof component;',
    'export type ComponentToken<D extends ComponentDomain> = keyof (typeof component)[D];',
    'export type ThemeName = keyof typeof themes;',
    'export declare function cssVar(name: SemanticToken | RuntimeToken): string;',
    'export declare function componentVar<D extends ComponentDomain>(domain: D, name: ComponentToken<D> & string): string;',
    'declare const _default: { prefix: typeof prefix; base: typeof base; semantic: typeof semantic; component: typeof component; componentVars: typeof componentVars; componentRefs: typeof componentRefs; domains: typeof domains; runtime: typeof runtime; vars: typeof vars; refs: typeof refs; constants: typeof constants; themes: typeof themes; skins: typeof skins; skinThemes: typeof skinThemes; cssVar: typeof cssVar; componentVar: typeof componentVar };',
    'export default _default;', ''].join('\n');
}

export function renderResolved(c) {
  return JSON.stringify(nest(c), null, 2) + '\n';
}

export function build(src, out, skinsPath = skinsDir) {
  const c = compile(src);
  Object.defineProperty(c, 'skins', { value: compileSkins(src, c, loadSkins(skinsPath)), enumerable: false });
  return {
    [join(out, 'dist/tokens.css')]: renderCss(c),
    [join(out, 'dist/tokens.js')]: renderJs(c),
    [join(out, 'dist/tokens.d.ts')]: renderDts(c),
    [join(out, 'dist/tokens.resolved.json')]: renderResolved(c),
    [join(out, 'src/tokens.ts')]: renderJs(c, { ts: true }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = build(load(srcPath), outDir);
  let stale = 0;
  for (const [path, text] of Object.entries(files)) {
    if (check) {
      if (!existsSync(path) || readFileSync(path, 'utf8') !== text) { console.error(`stale: ${path}`); stale++; }
    } else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
  }
  if (check && stale) { console.error('Run: node scripts/build-tokens.mjs'); process.exit(1); }
  const c = compile(load(srcPath));
  const per = Object.keys(c.domains).map((d) => `${d} ${[...c.component.values()].filter((t) => t.domain === d).length}`).join(', ');
  console.log(`${check ? 'checked' : 'built'}: ${c.base.size} base, ${c.semantic.size} semantic, ${c.component.size} component (${per}), ${c.runtime.size} runtime tokens`);
}
