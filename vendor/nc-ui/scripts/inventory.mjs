#!/usr/bin/env node
// Token inventory: every place ASTRID defined a colour, font or size, mapped to the nc-ui token that now owns it.
// Reads the tokenisation branch of an ASTRID checkout against its base commit (plain node + git, no deps).
//
//   node scripts/inventory.mjs --astrid ../NetComposer-Synth --base 9325a89 [--head HEAD] [--out docs/token-inventory.md]
//
// Line numbers are ASTRID's lines at --base (before tokenisation), so they point at the original literal.
// nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const astrid = args.astrid ?? '../NetComposer-Synth';
const baseRef = args.base ?? 'main';
const head = args.head ?? 'HEAD';
const out = args.out ?? join(here, '..', 'docs', 'token-inventory.md');
const resolved = JSON.parse(readFileSync(join(here, '..', 'dist', 'tokens.resolved.json'), 'utf8'));

const git = (...a) => execFileSync('git', ['-C', astrid, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });
const paths = ['artifacts/netcomposer-synth/src', 'lib/synth-audio/src'];
const diff = git('diff', '-U0', '--no-color', `${baseRef}..${head}`, '--', ...paths, ':(exclude)*.test.*');

const LITERAL = /#[0-9a-fA-F]{6}\b|hsl\([^)]*\)|rgba?\([^)]*\)|'IBM Plex Mono'(?:, monospace)?|'Inter'(?:, 'Geist')?(?:, sans-serif)?|Georgia, serif|"monospace"|-?\d*\.?\d+(?:px|em|rem|s)\b|\b(?:opacity|strokeWidth|fontSize|weight|lineWidth)[=:]\s*["'{]?\.?\d+(?:\.\d+)?|\d+ \d+% \d+%/g;
const DOMAINS = Object.keys(resolved.domains ?? {});
const D = DOMAINS.join('|') || 'none';
const TOKEN = new RegExp(String.raw`var\(--nc-ui-([\w-]+)\)|\bnc\['([\w-]+)'\]|\bnc\.([a-z][\w]*)\b|ncBase\.([\w-]+)(?:\.([\w-]+)|\['([\w-]+)'\])|@netcomposer\/nc-ui\/(color|tokens\.css)|var\(--nc-(${D})-([\w-]+)\)|\bcomponent\.(${D})\['([\w-]+)'\]`, 'g');
const rows = [];
let file = null, oldLine = 0, removed = [], added = [];
const flush = () => {
  if (removed.length && added.length && removed.length !== added.length) {
    // a block rewrite (e.g. surprise.ts): one row for the block
    removed = [{ line: removed[0].line, text: removed.map((r) => r.text).join(' ') }];
    added = [added.join(' ')];
  }
  for (let i = 0; i < Math.max(removed.length, added.length); i++) {
    const r = removed[i], a = added[i];
    if (!r || !a) continue;
    const lits = [...new Set(r.text.match(LITERAL) ?? [])];
    const toks = [...new Set([...a.matchAll(TOKEN)].map((m) => m[1] ?? m[2] ?? m[3] ?? (m[4] ? `${m[4]}.${m[5] ?? m[6]}` : m[8] ? `${m[8]}.${m[9]}` : m[10] ? `${m[10]}.${m[11]}` : `@netcomposer/nc-ui/${m[7]} (re-export)`)))];
    if (toks.length) rows.push({ file, line: r.line, lits, toks });
  }
  removed = []; added = [];
};
for (const l of diff.split('\n')) {
  if (l.startsWith('diff --git')) { flush(); file = null; }
  else if (l.startsWith('+++ ')) file = l.slice(6);
  else if (l.startsWith('@@')) { flush(); oldLine = Number(/-(\d+)/.exec(l)[1]); }
  else if (l.startsWith('-') && !l.startsWith('---')) removed.push({ line: oldLine++, text: l.slice(1) });
  else if (l.startsWith('+') && !l.startsWith('+++')) added.push(l.slice(1));
}
flush();

const isComponent = (t) => { const [d, n] = t.split('.'); return n !== undefined && DOMAINS.includes(d) && n in resolved.component[d]; };
const kindOf = (t) => (t in resolved.semantic ? 'semantic' : t in resolved.runtime ? 'runtime' : isComponent(t) ? `component (${t.split('.')[0]})` : t.startsWith('@netcomposer') ? 'module' : 'base');
const byToken = new Map();
for (const r of rows) for (const t of r.toks) byToken.set(t, (byToken.get(t) ?? 0) + 1);
const semanticUsed = [...byToken.keys()].filter((t) => kindOf(t) === 'semantic').length;
const componentUsed = [...byToken.keys()].filter((t) => kindOf(t).startsWith('component')).length;

// Contract preview (what the module lint will see): scan every source file at HEAD, assign it to the
// domain with the longest matching $scope, and count lines that read base tokens or another domain's tokens.
const scopeOf = (f) => {
  let best = null, len = -1;
  for (const [d, info] of Object.entries(resolved.domains ?? {})) for (const g of info.scope ?? []) {
    const pre = g.replace(/\*\*.*$/, '');
    if (f.startsWith(pre) && pre.length > len) { best = d; len = pre.length; }
  }
  return best;
};
const contract = new Map();
const tree = git('ls-tree', '-r', '--name-only', head, '--', ...paths).split('\n')
  .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f));
for (const f of tree) {
  const d = scopeOf(f) ?? '(none)';
  const c = contract.get(f) ?? { domain: d, base: 0, semantic: 0, own: 0, foreign: [] };
  for (const line of git('show', `${head}:${f}`).split('\n')) {
    const toks = [...line.matchAll(TOKEN)].map((m) => m[1] ?? m[2] ?? m[3] ?? (m[4] ? `${m[4]}.${m[5] ?? m[6]}` : m[8] ? `${m[8]}.${m[9]}` : m[10] ? `${m[10]}.${m[11]}` : null)).filter(Boolean);
    if (!toks.length) continue;
    const kinds = toks.map(kindOf);
    if (kinds.includes('base')) c.base++;
    if (kinds.includes('semantic') || kinds.includes('runtime')) c.semantic++;
    if (kinds.includes(`component (${d})`)) c.own++;
    for (const t of toks) if (kindOf(t).startsWith('component') && !t.startsWith(`${d}.`)) c.foreign.push(t);
  }
  if (c.base + c.semantic + c.own + c.foreign.length) contract.set(f, c);
}
const short = (f) => f.replace('artifacts/netcomposer-synth/src/', 'synth/').replace('lib/synth-audio/src/', 'synth-audio/');
const esc = (s) => s.replace(/\|/g, '\\|');

let md = readFileSync(join(here, 'inventory-intro.md'), 'utf8')
  .replaceAll('{{BASE}}', git('rev-parse', '--short', baseRef).trim())
  .replaceAll('{{HEAD}}', git('rev-parse', '--short', head).trim())
  .replaceAll('{{ROWS}}', String(rows.length))
  .replaceAll('{{FILES}}', String(new Set(rows.map((r) => r.file)).size))
  .replaceAll('{{TOKENS}}', String(byToken.size))
  .replaceAll('{{SEMANTIC_USED}}', String(semanticUsed))
  .replaceAll('{{COMPONENT_USED}}', String(componentUsed));
md += '\n## Usage map (file:line at the base commit, literal, token)\n\n';
const files = [...new Set(rows.map((r) => r.file))];
for (const f of files) {
  md += `\n### ${short(f)}\n\n| line | was | now reads |\n|---:|---|---|\n`;
  for (const r of rows.filter((x) => x.file === f)) md += `| ${r.line} | ${esc(r.lits.map((x) => '`' + x + '`').join(' ') || '(see line)')} | ${r.toks.map((t) => '`' + t + '`').join(' ')} |\n`;
}
md += '\n## Token use counts (lines that read each token)\n\n| token | tier | lines |\n|---|---|---:|\n';
for (const [t, n] of [...byToken].sort((a, b) => b[1] - a[1])) md += `| \`${t}\` | ${kindOf(t)} | ${n} |\n`;
md += '\n## Contract preview (lines per file at HEAD; the module lint will enforce this)\n\n';
md += 'A module may read generic semantic tokens and its own domain\'s component tokens; never base tokens, never another domain\'s. ';
md += '`base` lines are what the lint would flag today (see "Base tokens still read by modules" above).\n\n';
md += '| file | domain | semantic | own component | base (lint) | other domain (lint) |\n|---|---|---:|---:|---:|---|\n';
const tot = { semantic: 0, own: 0, base: 0, foreign: 0 };
for (const [f, c] of [...contract].sort((a, b) => b[1].base - a[1].base)) {
  md += `| ${short(f)} | ${c.domain} | ${c.semantic} | ${c.own} | ${c.base} | ${c.foreign.length ? [...new Set(c.foreign)].join(', ') : '0'} |\n`;
  tot.semantic += c.semantic; tot.own += c.own; tot.base += c.base; tot.foreign += c.foreign.length;
}
md += `| **total** | | ${tot.semantic} | ${tot.own} | ${tot.base} | ${tot.foreign} |\n`;
writeFileSync(out, md);
console.log(`contract preview: ${tot.semantic} semantic, ${tot.own} own-component, ${tot.base} base, ${tot.foreign} cross-domain lines`);
console.log(`inventory: ${rows.length} lines in ${files.length} files, ${byToken.size} tokens -> ${out}`);
