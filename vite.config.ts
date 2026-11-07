import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { ncUiLive } from "./vendor/nc-ui/vite.js";

const vendor = (path: string) => fileURLToPath(new URL(`./vendor/${path}`, import.meta.url));

// Served at netcomposer.art/aria/, next to /studio/ and the instruments (one origin: the Studio loads ARIA in a
// same-origin iframe). The look comes from the one live nc-ui at /nc-ui/ (ncUiLive links it last in <head>).
export default defineConfig({
  base: "/aria/",
  plugins: [ncUiLive()],
  resolve: {
    alias: [
      { find: "@netcomposer/nc-situation", replacement: vendor("nc-situation/src/index.ts") },
      { find: /^@netcomposer\/nc-ui$/, replacement: vendor("nc-ui/dist/nc-ui.min.js") },
    ],
  },
  build: {
    target: "es2022",
  },
  worker: {
    format: "es",
  },
});
