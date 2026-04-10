// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildSdkRunnerScript } from "./sdk-runner-template";

describe("buildSdkRunnerScript", () => {
  describe("query mode", () => {
    it("generates a script that imports query from the SDK", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/output.jsonl",
        mode: "query",
      });
      expect(script).toContain('import { query } from "@anthropic-ai/claude-agent-sdk"');
    });

    it("embeds the output file path", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/workspace/.runner-output.jsonl",
        mode: "query",
      });
      expect(script).toContain("/workspace/.runner-output.jsonl");
    });

    it("uses default model when none specified", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/out.jsonl",
        mode: "query",
      });
      expect(script).toContain("claude-sonnet-4-5-20250929");
    });

    it("uses custom model when specified", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/out.jsonl",
        mode: "query",
        model: "claude-opus-4-6",
      });
      expect(script).toContain("claude-opus-4-6");
    });

    it("includes system prompt append when provided", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/out.jsonl",
        mode: "query",
        systemPromptAppend: "Always respond in JSON.",
      });
      expect(script).toContain("Always respond in JSON.");
      expect(script).toContain("systemPrompt");
    });

    it("includes MCP servers when provided", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/out.jsonl",
        mode: "query",
        mcpServers: {
          myServer: { command: "node", args: ["server.js"], env: { PORT: "3000" } },
        },
      });
      expect(script).toContain("myServer");
      expect(script).toContain("server.js");
    });

    it("includes hook callbacks when hookConfig is provided", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/out.jsonl",
        mode: "query",
        hookConfig: {
          convexUrl: "https://example.convex.cloud",
          hookSecret: "secret123",
          sandboxId: "sbx-1",
        },
      });
      expect(script).toContain("PostToolUse");
      expect(script).toContain("https://example.convex.cloud");
      expect(script).toContain("hook-events");
      expect(script).toContain("sbx-1");
    });

    it("omits hook callbacks when hookConfig is not provided", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/out.jsonl",
        mode: "query",
      });
      expect(script).toContain("const hookCallbacks = undefined");
      expect(script).not.toContain("PostToolUse");
    });
  });

  describe("session mode", () => {
    it("generates a script that imports createSession from the SDK", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/output.jsonl",
        mode: "session",
      });
      expect(script).toContain("unstable_v2_createSession");
    });

    it("includes readline for interactive input", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/output.jsonl",
        mode: "session",
      });
      expect(script).toContain("createInterface");
      expect(script).toContain("readline");
    });

    it("does not include query import in session mode", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/output.jsonl",
        mode: "session",
      });
      expect(script).not.toContain("import { query }");
    });

    it("starts with shebang line", () => {
      const script = buildSdkRunnerScript({
        outputFile: "/tmp/output.jsonl",
        mode: "session",
      });
      expect(script.trimStart()).toMatch(/^#!\/usr\/bin\/env node/);
    });
  });
});
