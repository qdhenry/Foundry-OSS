import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    root: "src",
    globals: false,
    restoreMocks: true,
  },
});
