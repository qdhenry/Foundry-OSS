import React from "react";
import type { Preview } from "@storybook/nextjs-vite";
import { ThemeProvider } from "../apps/web/src/lib/theme";
import {
  SandboxBackendProvider,
  type ISandboxBackend,
} from "../packages/ui/src/backend";
import { SandboxHUDProvider } from "../packages/ui/src/sandbox/SandboxHUDContext";
import * as convexMockModule from "./mocks/convex";
import "../apps/web/src/app/globals.css";

type ConvexMockBridge = {
  setMockOverrides?: (overrides: Record<string, unknown>) => void;
  clearMockOverrides?: () => void;
};

const convexMocks: ConvexMockBridge =
  (convexMockModule as ConvexMockBridge).setMockOverrides ||
  (convexMockModule as ConvexMockBridge).clearMockOverrides
    ? (convexMockModule as ConvexMockBridge)
    : (((convexMockModule as { default?: ConvexMockBridge }).default ??
        {}) as ConvexMockBridge);

const STORYBOOK_SANDBOX_BACKEND: ISandboxBackend = {
  getTerminalConnectionInfo: async ({ sessionId }) => ({
    wsUrl: "ws://localhost:3000/sandbox-terminal",
    token: "storybook-token",
    sandboxId: sessionId,
  }),
  listFiles: async () => ({
    cwd: "/workspace",
    entries: [],
  }),
  readFile: async ({ path }) => ({
    path,
    content: "",
  }),
  writeFile: async () => null,
  sendChatMessage: async () => null,
  cancelSession: async () => null,
  restartSession: async () => null,
};

const DEFAULT_STORY_CONVEX_OVERRIDES: Record<string, unknown> = {
  "sandbox:sessions:getChatMessages": [],
  "sandbox:logs:listBySession": [],
  "executionAudit:listByTask": [],
};

function withSandboxProviders(story: React.ReactNode) {
  return (
    <SandboxBackendProvider backend={STORYBOOK_SANDBOX_BACKEND}>
      <SandboxHUDProvider>{story}</SandboxHUDProvider>
    </SandboxBackendProvider>
  );
}

const FOUNDRY_VIEWPORTS = {
  mobile: {
    name: "Mobile",
    styles: { width: "375px", height: "812px" },
  },
  tablet: {
    name: "Tablet",
    styles: { width: "768px", height: "1024px" },
  },
  desktop: {
    name: "Desktop",
    styles: { width: "1280px", height: "800px" },
  },
};

const preview: Preview = {
  initialGlobals: {
    theme: "light",
  },
  globalTypes: {
    theme: {
      description: "Toggle light/dark mode",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
          { value: "side-by-side", title: "Side by Side", icon: "sidebar" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "padded",
    viewport: {
      viewports: FOUNDRY_VIEWPORTS,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/dashboard",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
  decorators: [
    // Convex mock data decorator: applies per-story mock overrides from parameters.convexMockData
    (Story, context) => {
      const overrides = context.parameters.convexMockData as Record<string, unknown> | undefined;
      if (overrides || convexMocks.setMockOverrides) {
        convexMocks.setMockOverrides?.({
          ...DEFAULT_STORY_CONVEX_OVERRIDES,
          ...(overrides ?? {}),
        });
      } else {
        convexMocks.clearMockOverrides?.();
      }
      return <Story />;
    },
    // Theme decorator: applies light/dark class to documentElement + wraps in ThemeProvider
    (Story, context) => {
      const theme = context.globals.theme ?? "light";
      const root = document.documentElement;

      if (theme === "side-by-side") {
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="light" style={{ padding: "1rem", background: "var(--surface-page)" }}>
              <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                LIGHT
              </div>
              <ThemeProvider>{withSandboxProviders(<Story />)}</ThemeProvider>
            </div>
            <div className="dark" style={{ padding: "1rem", background: "var(--surface-page)" }}>
              <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                DARK
              </div>
              <ThemeProvider>{withSandboxProviders(<Story />)}</ThemeProvider>
            </div>
          </div>
        );
      }

      root.classList.toggle("dark", theme === "dark");
      root.classList.toggle("light", theme === "light");

      return (
        <ThemeProvider>
          <div style={{ background: "var(--surface-page)", minHeight: "100px", padding: "1rem" }}>
            {withSandboxProviders(<Story />)}
          </div>
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
