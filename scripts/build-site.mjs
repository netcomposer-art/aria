// Builds ARIA Situation for netcomposer.art/aria/ (one origin with the Studio and the instruments).
// Output: dist, plus BUILD.txt saying which commit it is. The netcomposer.art repo copies that folder to aria/
// (node tools/pull-app.mjs aria --from <this clone>).
// Usage: pnpm build:site  (or: node scripts/build-site.mjs). Needs node_modules installed.
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bin = (name) => join(root, "node_modules", ".bin", name);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit" });

run(bin("tsc"), ["--noEmit"]);
run(bin("vite"), ["build", "--emptyOutDir"]);

const out = join(root, "dist");
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const maps = walk(out).filter((p) => p.endsWith(".map"));
if (maps.length) throw new Error(`build-site: source maps must not ship: ${maps.join(", ")}`);
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--untracked-files=no") !== "";
writeFileSync(
  join(out, "BUILD.txt"),
  [
    "app: ARIA Situation",
    "repo: netcomposer-art/aria",
    `commit: ${git("rev-parse", "HEAD")}${dirty ? " (with uncommitted changes)" : ""}`,
    `built: ${new Date().toISOString()}`,
    "base: /aria/",
    "",
  ].join("\n"),
);
console.log(`build-site: ${out} (base /aria/, ${walk(out).length} files)`);
