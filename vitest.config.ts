import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@netcomposer/nc-situation",
        replacement: fileURLToPath(new URL("./vendor/nc-situation/src/index.ts", import.meta.url)),
      },
    ],
  },
  test: { include: ["tests/**/*.test.ts"] },
});
