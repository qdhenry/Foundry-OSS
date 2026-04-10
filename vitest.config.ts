import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Sandbox extraction bridge for app imports used in stories/tests.
      {
        find: "@/lib/sandboxHUDContext",
        replacement: path.resolve(
          dirname,
          "./packages/ui/src/sandbox/SandboxHUDContext.tsx"
        ),
      },
      {
        find: "@/lib/sandboxBackendContext",
        replacement: path.resolve(dirname, "./packages/ui/src/backend.tsx"),
      },
      { find: /^@\//, replacement: path.resolve(dirname, "./apps/web/src") + "/" },
      {
        find: /^@foundry\/ui$/,
        replacement: path.resolve(dirname, "./packages/ui/src/index.ts"),
      },
      {
        find: /^@foundry\/ui\/(.*)$/,
        replacement: path.resolve(dirname, "./packages/ui/src/$1"),
      },
      {
        find: /^@foundry\/types$/,
        replacement: path.resolve(dirname, "./packages/types/src/index.ts"),
      },
      {
        find: /^@foundry\/types\/(.*)$/,
        replacement: path.resolve(dirname, "./packages/types/src/$1"),
      },
    ],
  },
  test: {
    projects: [
      {
        resolve: {
          alias: [
            {
              find: "@/lib/sandboxHUDContext",
              replacement: path.resolve(
                dirname,
                "./packages/ui/src/sandbox/SandboxHUDContext.tsx"
              ),
            },
            {
              find: "@/lib/sandboxBackendContext",
              replacement: path.resolve(
                dirname,
                "./packages/ui/src/backend.tsx"
              ),
            },
            {
              find: /^@\//,
              replacement:
                path.resolve(dirname, "./apps/web/src") + "/",
            },
            {
              find: /^@foundry\/ui$/,
              replacement: path.resolve(
                dirname,
                "./packages/ui/src/index.ts"
              ),
            },
            {
              find: /^@foundry\/ui\/(.*)$/,
              replacement: path.resolve(dirname, "./packages/ui/src/$1"),
            },
            {
              find: /^@foundry\/types$/,
              replacement: path.resolve(
                dirname,
                "./packages/types/src/index.ts"
              ),
            },
            {
              find: /^@foundry\/types\/(.*)$/,
              replacement: path.resolve(
                dirname,
                "./packages/types/src/$1"
              ),
            },
          ],
        },
        test: {
          name: "unit",
          globals: true,
          environment: "jsdom",
          setupFiles: ["./apps/web/src/test/setup.ts"],
          include: [
            "apps/web/src/**/*.test.{ts,tsx}",
            "apps/desktop/src/**/*.test.{ts,tsx}",
            "packages/ui/src/**/*.test.{ts,tsx}",
            "convex/**/*.test.ts",
            "sandbox-worker/**/*.test.ts",
          ],
          coverage: {
            provider: "v8",
            thresholds: {
              statements: 90,
              branches: 90,
              functions: 90,
              lines: 90,
            },
            include: [
              "apps/web/src/**/*.{ts,tsx}",
              "packages/ui/src/**/*.{ts,tsx}",
            ],
            exclude: [
              "**/*.test.{ts,tsx}",
              "**/*.spec.{ts,tsx}",
              "**/*.stories.{ts,tsx}",
              "**/test/**",
              "**/__tests__/**",
            ],
          },
        },
      },
      {
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          globals: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
});
