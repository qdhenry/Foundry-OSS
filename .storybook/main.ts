import type { StorybookConfig } from "@storybook/nextjs-vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: [
    "../packages/ui/src/**/*.stories.@(ts|tsx)",
    "../apps/web/src/components/**/*.stories.@(ts|tsx)",
    "../apps/web/src/app/**/*.stories.@(ts|tsx)",
    "../apps/web/src/stories/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../apps/web/public"],
  docs: { autodocs: "tag" },
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    const existingAliases = Array.isArray(config.resolve.alias)
      ? config.resolve.alias
      : Object.entries((config.resolve.alias as Record<string, string>) ?? {}).map(
          ([find, replacement]) => ({ find, replacement })
        );

    config.resolve.alias = [
      // Sandbox extraction bridge: keep app-level imports pointed at package contexts.
      {
        find: "@/lib/sandboxHUDContext",
        replacement: path.resolve(
          __dirname,
          "../packages/ui/src/sandbox/SandboxHUDContext.tsx"
        ),
      },
      {
        find: "@/lib/sandboxBackendContext",
        replacement: path.resolve(__dirname, "../packages/ui/src/backend.tsx"),
      },
      // Package aliases
      {
        find: /^@foundry\/ui$/,
        replacement: path.resolve(__dirname, "../packages/ui/src/index.ts"),
      },
      {
        find: /^@foundry\/ui\/(.*)$/,
        replacement: path.resolve(__dirname, "../packages/ui/src/$1"),
      },
      {
        find: /^@foundry\/types$/,
        replacement: path.resolve(__dirname, "../packages/types/src/index.ts"),
      },
      {
        find: /^@foundry\/types\/(.*)$/,
        replacement: path.resolve(__dirname, "../packages/types/src/$1"),
      },
      // Convex mocks — intercept all Convex React hooks
      {
        find: "convex/react",
        replacement: path.resolve(__dirname, "./mocks/convex.ts"),
      },
      {
        find: "convex/react-clerk",
        replacement: path.resolve(__dirname, "./mocks/convex-react-clerk.ts"),
      },
      // Clerk mocks — intercept all Clerk hooks and components
      {
        find: "@clerk/nextjs",
        replacement: path.resolve(__dirname, "./mocks/clerk.ts"),
      },
      {
        find: "@clerk/clerk-react",
        replacement: path.resolve(__dirname, "./mocks/clerk.ts"),
      },
      // ProgramContext mock — bypass Convex query in ProgramProvider
      {
        find: "@/lib/programContext",
        replacement: path.resolve(__dirname, "./mocks/program-context.tsx"),
      },
      ...existingAliases,
    ];
    return config;
  },
};

export default config;
