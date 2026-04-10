import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  access: vi.fn(),
  constants: { F_OK: 0 },
}));

describe("auth-detector", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("detectAuthStatus", () => {
    it("returns manual_config when config file has API key", async () => {
      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockImplementation(async (path) => {
        if (typeof path === "string" && path.includes("auth.json")) {
          return JSON.stringify({ apiKey: "sk-ant-api-key-test-12345" });
        }
        throw new Error("ENOENT");
      });

      const { detectAuthStatus } = await import("./auth-detector.js");
      const status = await detectAuthStatus();

      expect(status.source).toBe("manual_config");
      expect(status.isConfigured).toBe(true);
      expect(status.apiKeyPrefix).toBe("sk-ant-api...");
    });

    it("returns env_var when ANTHROPIC_API_KEY is set", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-env-key-12345678";

      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const { detectAuthStatus } = await import("./auth-detector.js");
      const status = await detectAuthStatus();

      expect(status.source).toBe("env_var");
      expect(status.isConfigured).toBe(true);
      expect(status.apiKeyPrefix).toBe("sk-ant-env...");
    });

    it("returns claude_code_oauth when Claude Code is installed with email", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockImplementation(async (path) => {
        if (typeof path === "string" && path.includes(".claude.json")) {
          return JSON.stringify({
            oauthAccount: { emailAddress: "user@example.com" },
          });
        }
        throw new Error("ENOENT");
      });

      const { detectAuthStatus } = await import("./auth-detector.js");
      const status = await detectAuthStatus();

      expect(status.source).toBe("claude_code_oauth");
      expect(status.isConfigured).toBe(true);
      expect(status.claudeCodeEmail).toBe("user@example.com");
    });

    it("returns none when nothing is configured", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const { detectAuthStatus } = await import("./auth-detector.js");
      const status = await detectAuthStatus();

      expect(status.source).toBe("none");
      expect(status.isConfigured).toBe(false);
    });
  });

  describe("getApiKey", () => {
    it("returns manual config key when available", async () => {
      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockImplementation(async (path) => {
        if (typeof path === "string" && path.includes("auth.json")) {
          return JSON.stringify({ apiKey: "sk-ant-manual-key" });
        }
        throw new Error("ENOENT");
      });

      const { getApiKey } = await import("./auth-detector.js");
      const key = await getApiKey();

      expect(key).toBe("sk-ant-manual-key");
    });

    it("returns env key when no manual config", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-env-key";

      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const { getApiKey } = await import("./auth-detector.js");
      const key = await getApiKey();

      expect(key).toBe("sk-ant-env-key");
    });

    it("returns null when no key available", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const { getApiKey } = await import("./auth-detector.js");
      const key = await getApiKey();

      expect(key).toBeNull();
    });
  });

  describe("setApiKey", () => {
    it("creates config directory and writes key file", async () => {
      const { mkdir, writeFile } = await import("node:fs/promises");
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const { setApiKey } = await import("./auth-detector.js");
      await setApiKey("sk-ant-new-key");

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining(".config"),
        expect.objectContaining({ recursive: true, mode: 0o700 }),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("auth.json"),
        JSON.stringify({ apiKey: "sk-ant-new-key" }),
        expect.objectContaining({ mode: 0o600 }),
      );
    });
  });

  describe("clearApiKey", () => {
    it("removes config file when it exists", async () => {
      const { access, unlink } = await import("node:fs/promises");
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(unlink).mockResolvedValue(undefined);

      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const { clearApiKey } = await import("./auth-detector.js");
      await clearApiKey();

      expect(unlink).toHaveBeenCalledWith(expect.stringContaining("auth.json"));
    });

    it("does not throw when config file does not exist", async () => {
      const { access } = await import("node:fs/promises");
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));

      const { readFile } = await import("node:fs/promises");
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const { clearApiKey } = await import("./auth-detector.js");
      await expect(clearApiKey()).resolves.toBeUndefined();
    });
  });
});
