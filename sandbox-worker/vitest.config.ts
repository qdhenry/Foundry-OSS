import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@foundry\/types$/,
        replacement: path.resolve(dirname, "../packages/types/src/index.ts"),
      },
      {
        find: /^@foundry\/types\/(.*)$/,
        replacement: path.resolve(dirname, "../packages/types/src/$1"),
      },
    ],
  },
  test: {
    environment: "node",
    root: "src",
    globals: false,
    restoreMocks: true,
  },
});
