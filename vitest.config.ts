import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      "@dyknow/app": resolve(__dirname, "packages/app/src/index.ts"),
      "@dyknow/core": resolve(__dirname, "packages/core/src/index.ts"),
    },
  },
});
