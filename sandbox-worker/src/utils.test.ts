// @vitest-environment node

import type {
  CreateSandboxRequest,
  ExecuteSandboxRequest,
  SandboxLogStreamEvent,
} from "@foundry/types";
import { describe, expect, it, vi } from "vitest";
import {
  buildCloneUrl,
  createPendingSetupProgress,
  decodeStreamData,
  errorToMessage,
  extractExitCode,
  extractTextOutput,
  firstString,
  formatSse,
  generateTerminalToken,
  isNonEmptyString,
  isRecord,
  normalizeRepoUrl,
  normalizeSetupProgress,
  nowIso,
  redactRepoUrl,
  shellEscape,
  splitLines,
  stageMetadata,
  toExecOptions,
  validateCreateRequest,
  validateExecuteRequest,
  validateTerminalToken,
} from "./utils";

// ---------------------------------------------------------------------------
// createPendingSetupProgress
// ---------------------------------------------------------------------------
describe("createPendingSetupProgress", () => {
  it("returns all 10 stages as pending", () => {
    const progress = createPendingSetupProgress();
    const stages = Object.keys(progress);
    expect(stages).toHaveLength(10);
    for (const stage of stages) {
      expect((progress as any)[stage]).toEqual({ status: "pending" });
    }
  });

  it("contains the expected stage names", () => {
    const progress = createPendingSetupProgress();
    expect(progress).toHaveProperty("containerProvision");
    expect(progress).toHaveProperty("systemSetup");
    expect(progress).toHaveProperty("authSetup");
    expect(progress).toHaveProperty("claudeConfig");
    expect(progress).toHaveProperty("gitClone");
    expect(progress).toHaveProperty("depsInstall");
    expect(progress).toHaveProperty("mcpInstall");
    expect(progress).toHaveProperty("workspaceCustomization");
    expect(progress).toHaveProperty("healthCheck");
    expect(progress).toHaveProperty("ready");
  });

  it("returns a new object each call", () => {
    const a = createPendingSetupProgress();
    const b = createPendingSetupProgress();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// normalizeSetupProgress
// ---------------------------------------------------------------------------
describe("normalizeSetupProgress", () => {
  it("returns default pending progress for non-record input", () => {
    const result = normalizeSetupProgress(null);
    expect(result).toEqual(createPendingSetupProgress());
  });

  it("returns default pending progress for undefined", () => {
    expect(normalizeSetupProgress(undefined)).toEqual(createPendingSetupProgress());
  });

  it("returns default pending progress for a string", () => {
    expect(normalizeSetupProgress("hello")).toEqual(createPendingSetupProgress());
  });

  it("preserves valid completed stage state", () => {
    const input = {
      containerProvision: { status: "completed", startedAt: 1000, completedAt: 2000 },
    };
    const result = normalizeSetupProgress(input);
    expect(result.containerProvision).toEqual({
      status: "completed",
      startedAt: 1000,
      completedAt: 2000,
    });
    expect(result.systemSetup).toEqual({ status: "pending" });
  });

  it("preserves valid running stage state", () => {
    const input = {
      gitClone: { status: "running", startedAt: 5000 },
    };
    const result = normalizeSetupProgress(input);
    expect(result.gitClone).toEqual({ status: "running", startedAt: 5000 });
  });

  it("preserves valid failed stage state", () => {
    const input = {
      depsInstall: { status: "failed", startedAt: 1000, failedAt: 2000, error: "npm crash" },
    };
    const result = normalizeSetupProgress(input);
    expect(result.depsInstall).toEqual({
      status: "failed",
      startedAt: 1000,
      failedAt: 2000,
      error: "npm crash",
    });
  });

  it("preserves valid skipped stage state", () => {
    const input = {
      mcpInstall: { status: "skipped", reason: "not needed", skippedAt: 3000 },
    };
    const result = normalizeSetupProgress(input);
    expect(result.mcpInstall).toEqual({ status: "skipped", reason: "not needed", skippedAt: 3000 });
  });

  it("falls back to pending for invalid stage state", () => {
    const input = {
      containerProvision: { status: "completed" }, // missing startedAt/completedAt
    };
    const result = normalizeSetupProgress(input);
    expect(result.containerProvision).toEqual({ status: "pending" });
  });

  it("falls back to pending for running without startedAt", () => {
    const input = {
      authSetup: { status: "running" }, // missing startedAt
    };
    const result = normalizeSetupProgress(input);
    expect(result.authSetup).toEqual({ status: "pending" });
  });

  it("falls back to pending for unknown status value", () => {
    const input = {
      claudeConfig: { status: "unknown_value" },
    };
    const result = normalizeSetupProgress(input);
    expect(result.claudeConfig).toEqual({ status: "pending" });
  });

  it("ignores non-stage keys", () => {
    const input = {
      containerProvision: { status: "pending" },
      extraKey: { status: "completed", startedAt: 1, completedAt: 2 },
    };
    const result = normalizeSetupProgress(input);
    expect(result).not.toHaveProperty("extraKey");
  });
});

// ---------------------------------------------------------------------------
// stageMetadata
// ---------------------------------------------------------------------------
describe("stageMetadata", () => {
  it("returns stage and stageStatus", () => {
    const meta = stageMetadata("gitClone", "running");
    expect(meta).toEqual({ stage: "gitClone", stageStatus: "running" });
  });

  it("merges extra properties", () => {
    const meta = stageMetadata("depsInstall", "failed", { error: "timeout" });
    expect(meta).toEqual({ stage: "depsInstall", stageStatus: "failed", error: "timeout" });
  });

  it("works without extra", () => {
    const meta = stageMetadata("ready", "completed");
    expect(meta).toEqual({ stage: "ready", stageStatus: "completed" });
  });
});

// ---------------------------------------------------------------------------
// shellEscape
// ---------------------------------------------------------------------------
describe("shellEscape", () => {
  it("wraps a normal string in single quotes", () => {
    expect(shellEscape("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellEscape("it's")).toBe(`'it'"'"'s'`);
  });

  it("escapes multiple single quotes", () => {
    expect(shellEscape("a'b'c")).toBe(`'a'"'"'b'"'"'c'`);
  });

  it("handles empty string", () => {
    expect(shellEscape("")).toBe("''");
  });

  it("does not escape double quotes", () => {
    expect(shellEscape('say "hi"')).toBe(`'say "hi"'`);
  });

  it("does not escape backticks", () => {
    expect(shellEscape("run `cmd`")).toBe("'run `cmd`'");
  });

  it("handles dollar signs", () => {
    expect(shellEscape("$HOME")).toBe("'$HOME'");
  });

  it("handles newlines", () => {
    expect(shellEscape("line1\nline2")).toBe("'line1\nline2'");
  });
});

// ---------------------------------------------------------------------------
// normalizeRepoUrl
// ---------------------------------------------------------------------------
describe("normalizeRepoUrl", () => {
  it("appends .git to HTTPS URL without it", () => {
    expect(normalizeRepoUrl("https://github.com/owner/repo")).toBe(
      "https://github.com/owner/repo.git",
    );
  });

  it("keeps .git suffix if already present", () => {
    expect(normalizeRepoUrl("https://github.com/owner/repo.git")).toBe(
      "https://github.com/owner/repo.git",
    );
  });

  it("converts short form owner/repo to full HTTPS URL", () => {
    expect(normalizeRepoUrl("owner/repo")).toBe("https://github.com/owner/repo.git");
  });

  it("converts github.com/owner/repo (no protocol) to full HTTPS URL", () => {
    expect(normalizeRepoUrl("github.com/owner/repo")).toBe("https://github.com/owner/repo.git");
  });

  it("removes .git from short form before re-adding it", () => {
    expect(normalizeRepoUrl("owner/repo.git")).toBe("https://github.com/owner/repo.git");
  });

  it("trims whitespace", () => {
    expect(normalizeRepoUrl("  https://github.com/owner/repo  ")).toBe(
      "https://github.com/owner/repo.git",
    );
  });

  it("handles HTTP (non-HTTPS) URLs", () => {
    expect(normalizeRepoUrl("http://github.com/owner/repo")).toBe(
      "http://github.com/owner/repo.git",
    );
  });
});

// ---------------------------------------------------------------------------
// buildCloneUrl
// ---------------------------------------------------------------------------
describe("buildCloneUrl", () => {
  it("returns normalized URL when no token", () => {
    expect(buildCloneUrl("owner/repo")).toBe("https://github.com/owner/repo.git");
  });

  it("returns normalized URL for empty token", () => {
    expect(buildCloneUrl("owner/repo", "")).toBe("https://github.com/owner/repo.git");
  });

  it("returns normalized URL for whitespace token", () => {
    expect(buildCloneUrl("owner/repo", "   ")).toBe("https://github.com/owner/repo.git");
  });

  it("injects token into github.com URL", () => {
    const result = buildCloneUrl("https://github.com/owner/repo.git", "ghp_abc123");
    expect(result).toContain("x-access-token:ghp_abc123@github.com");
    expect(result).toContain("https://");
  });

  it("trims token whitespace", () => {
    const result = buildCloneUrl("https://github.com/owner/repo.git", "  ghp_abc123  ");
    expect(result).toContain("ghp_abc123");
  });

  it("does not inject token for non-github host", () => {
    const result = buildCloneUrl("https://gitlab.com/owner/repo.git", "ghp_abc123");
    expect(result).toBe("https://gitlab.com/owner/repo.git");
  });

  it("works with short form repo and token", () => {
    const result = buildCloneUrl("owner/repo", "ghp_token");
    expect(result).toContain("x-access-token:ghp_token@github.com");
  });
});

// ---------------------------------------------------------------------------
// redactRepoUrl
// ---------------------------------------------------------------------------
describe("redactRepoUrl", () => {
  it("redacts password from URL with credentials", () => {
    const result = redactRepoUrl("https://x-access-token:ghp_secret@github.com/owner/repo.git");
    expect(result).toContain("***");
    expect(result).not.toContain("ghp_secret");
  });

  it("leaves URL without credentials unchanged", () => {
    const result = redactRepoUrl("https://github.com/owner/repo.git");
    expect(result).toBe("https://github.com/owner/repo.git");
  });

  it("falls back to regex for non-URL strings with token pattern", () => {
    // When new URL() throws, the catch branch uses regex replacement
    const result = redactRepoUrl("not-a-url x-access-token:ghp_secret@github.com/owner/repo.git");
    expect(result).toContain("x-access-token:***@");
    expect(result).not.toContain("ghp_secret");
  });

  it("preserves host and path", () => {
    const result = redactRepoUrl("https://x-access-token:ghp_secret@github.com/owner/repo.git");
    expect(result).toContain("github.com");
    expect(result).toContain("/owner/repo.git");
  });
});

// ---------------------------------------------------------------------------
// decodeStreamData
// ---------------------------------------------------------------------------
describe("decodeStreamData", () => {
  it("returns string input as-is", () => {
    expect(decodeStreamData("hello")).toBe("hello");
  });

  it("decodes Uint8Array to string", () => {
    const bytes = new TextEncoder().encode("test data");
    expect(decodeStreamData(bytes)).toBe("test data");
  });

  it("decodes serialized byte buffer object", () => {
    const data = { "0": 104, "1": 105 }; // "hi"
    expect(decodeStreamData(data)).toBe("hi");
  });

  it("JSON-stringifies a non-byte-buffer object", () => {
    const data = { key: "value" };
    expect(decodeStreamData(data)).toBe(JSON.stringify(data));
  });

  it("returns empty string for null", () => {
    expect(decodeStreamData(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(decodeStreamData(undefined)).toBe("");
  });

  it("converts number to string", () => {
    expect(decodeStreamData(42)).toBe("42");
  });

  it("converts boolean to string", () => {
    expect(decodeStreamData(true)).toBe("true");
  });

  it("handles empty object (non-byte-buffer)", () => {
    // Empty object has no entries, so entries.length === 0 -> JSON.stringify
    expect(decodeStreamData({})).toBe("{}");
  });

  it("handles mixed key types in object (not all numeric keys)", () => {
    const data = { "0": 100, name: "test" };
    expect(decodeStreamData(data)).toBe(JSON.stringify(data));
  });
});

// ---------------------------------------------------------------------------
// errorToMessage
// ---------------------------------------------------------------------------
describe("errorToMessage", () => {
  it("extracts message from Error instance", () => {
    expect(errorToMessage(new Error("boom"))).toBe("boom");
  });

  it("returns string as-is", () => {
    expect(errorToMessage("something failed")).toBe("something failed");
  });

  it('returns "Unknown error" for null', () => {
    expect(errorToMessage(null)).toBe("Unknown error");
  });

  it('returns "Unknown error" for undefined', () => {
    expect(errorToMessage(undefined)).toBe("Unknown error");
  });

  it('returns "Unknown error" for object', () => {
    expect(errorToMessage({ code: 500 })).toBe("Unknown error");
  });

  it('returns "Unknown error" for number', () => {
    expect(errorToMessage(42)).toBe("Unknown error");
  });
});

// ---------------------------------------------------------------------------
// extractExitCode
// ---------------------------------------------------------------------------
describe("extractExitCode", () => {
  it("extracts exitCode from object", () => {
    expect(extractExitCode({ exitCode: 0 })).toBe(0);
  });

  it("extracts code from object", () => {
    expect(extractExitCode({ code: 1 })).toBe(1);
  });

  it("extracts status from object", () => {
    expect(extractExitCode({ status: 127 })).toBe(127);
  });

  it("parses string exitCode", () => {
    expect(extractExitCode({ exitCode: "0" })).toBe(0);
  });

  it("returns undefined for non-record", () => {
    expect(extractExitCode("string")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(extractExitCode(null)).toBeUndefined();
  });

  it("returns undefined when no exit code key exists", () => {
    expect(extractExitCode({ output: "done" })).toBeUndefined();
  });

  it("returns undefined for NaN string code", () => {
    expect(extractExitCode({ exitCode: "abc" })).toBeUndefined();
  });

  it("returns undefined for Infinity", () => {
    expect(extractExitCode({ exitCode: Infinity })).toBeUndefined();
  });

  it("prefers exitCode over code", () => {
    expect(extractExitCode({ exitCode: 5, code: 10 })).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// extractTextOutput
// ---------------------------------------------------------------------------
describe("extractTextOutput", () => {
  it("returns string input directly", () => {
    expect(extractTextOutput("hello")).toBe("hello");
  });

  it("extracts stdout from object", () => {
    expect(extractTextOutput({ stdout: "output" })).toBe("output");
  });

  it("extracts output from object", () => {
    expect(extractTextOutput({ output: "data" })).toBe("data");
  });

  it("extracts message from object", () => {
    expect(extractTextOutput({ message: "info" })).toBe("info");
  });

  it("extracts text from object", () => {
    expect(extractTextOutput({ text: "content" })).toBe("content");
  });

  it("returns empty string for non-record", () => {
    expect(extractTextOutput(null)).toBe("");
    expect(extractTextOutput(42)).toBe("");
  });

  it("returns empty string when no text keys exist", () => {
    expect(extractTextOutput({ code: 0 })).toBe("");
  });

  it("prefers stdout over other keys", () => {
    expect(extractTextOutput({ stdout: "a", output: "b" })).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// splitLines
// ---------------------------------------------------------------------------
describe("splitLines", () => {
  it("splits by newlines", () => {
    expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("handles CRLF", () => {
    expect(splitLines("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
  });

  it("filters empty lines", () => {
    expect(splitLines("a\n\nb\n\n")).toEqual(["a", "b"]);
  });

  it("trims trailing whitespace from lines", () => {
    expect(splitLines("a  \nb  ")).toEqual(["a", "b"]);
  });

  it("returns empty array for empty string", () => {
    expect(splitLines("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(splitLines("   \n   ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatSse
// ---------------------------------------------------------------------------
describe("formatSse", () => {
  it("formats a log event with id", () => {
    const event = {
      type: "log" as const,
      log: { sequence: 42, level: "info", message: "hello", timestamp: "2025-01-01T00:00:00Z" },
    } as SandboxLogStreamEvent;
    const result = formatSse(event);
    expect(result).toContain("id: 42");
    expect(result).toContain("event: log");
    expect(result).toContain("data: ");
    expect(result).toMatch(/\n\n$/);
  });

  it("formats a status event without id", () => {
    const event = {
      type: "status" as const,
      status: "ready",
    } as SandboxLogStreamEvent;
    const result = formatSse(event);
    expect(result).not.toContain("id:");
    expect(result).toContain("event: status");
  });

  it("includes JSON-serialized data", () => {
    const event = {
      type: "status" as const,
      status: "ready",
    } as SandboxLogStreamEvent;
    const result = formatSse(event);
    const dataLine = result.split("\n").find((l: string) => l.startsWith("data: "));
    expect(dataLine).toBeTruthy();
    const parsed = JSON.parse(dataLine!.replace("data: ", ""));
    expect(parsed.type).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// nowIso
// ---------------------------------------------------------------------------
describe("nowIso", () => {
  it("returns an ISO 8601 timestamp", () => {
    const result = nowIso();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("returns a timestamp close to now", () => {
    const before = Date.now();
    const result = new Date(nowIso()).getTime();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before - 1000);
    expect(result).toBeLessThanOrEqual(after + 1000);
  });
});

// ---------------------------------------------------------------------------
// isNonEmptyString
// ---------------------------------------------------------------------------
describe("isNonEmptyString", () => {
  it("returns true for non-empty string", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isNonEmptyString("")).toBe(false);
  });

  it("returns false for whitespace-only string", () => {
    expect(isNonEmptyString("   ")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isNonEmptyString(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isNonEmptyString(undefined)).toBe(false);
  });

  it("returns false for number", () => {
    expect(isNonEmptyString(42)).toBe(false);
  });

  it("returns false for object", () => {
    expect(isNonEmptyString({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRecord
// ---------------------------------------------------------------------------
describe("isRecord", () => {
  it("returns true for plain object", () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("returns true for empty object", () => {
    expect(isRecord({})).toBe(true);
  });

  it("returns true for array (arrays are objects)", () => {
    // Note: isRecord checks `typeof value === "object"`, arrays pass this
    expect(isRecord([1, 2])).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isRecord("hello")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isRecord(42)).toBe(false);
  });

  it("returns false for boolean", () => {
    expect(isRecord(true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// firstString
// ---------------------------------------------------------------------------
describe("firstString", () => {
  it("returns the first non-empty string", () => {
    expect(firstString(null, undefined, "hello", "world")).toBe("hello");
  });

  it("skips empty strings", () => {
    expect(firstString("", "non-empty")).toBe("non-empty");
  });

  it("returns undefined when no strings found", () => {
    expect(firstString(null, undefined, 42)).toBeUndefined();
  });

  it("returns undefined for no arguments", () => {
    expect(firstString()).toBeUndefined();
  });

  it("returns first of multiple non-empty strings", () => {
    expect(firstString("a", "b")).toBe("a");
  });

  it("skips numbers and objects", () => {
    expect(firstString(0, false, {}, "found")).toBe("found");
  });
});

// ---------------------------------------------------------------------------
// toExecOptions
// ---------------------------------------------------------------------------
describe("toExecOptions", () => {
  it("maps timeoutMs to timeout", () => {
    const result = toExecOptions({ timeoutMs: 5000 });
    expect(result).toEqual({ timeout: 5000 });
  });

  it("maps env when non-empty", () => {
    const result = toExecOptions({ env: { PATH: "/usr/bin" } });
    expect(result).toEqual({ env: { PATH: "/usr/bin" } });
  });

  it("omits env when empty", () => {
    const result = toExecOptions({ env: {} });
    expect(result).toEqual({});
  });

  it("returns empty object for no options", () => {
    expect(toExecOptions({})).toEqual({});
  });

  it("combines timeout and env", () => {
    const result = toExecOptions({ timeoutMs: 3000, env: { NODE_ENV: "test" } });
    expect(result).toEqual({ timeout: 3000, env: { NODE_ENV: "test" } });
  });
});

// ---------------------------------------------------------------------------
// validateCreateRequest
// ---------------------------------------------------------------------------
describe("validateCreateRequest", () => {
  const validRequest: CreateSandboxRequest = {
    repoUrl: "owner/repo",
    branch: "main",
    worktreeBranch: "agent/task-1",
  } as CreateSandboxRequest;

  it("returns null for valid request", () => {
    expect(validateCreateRequest(validRequest)).toBeNull();
  });

  it("returns error for missing repoUrl", () => {
    const result = validateCreateRequest({ ...validRequest, repoUrl: "" } as CreateSandboxRequest);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("BAD_REQUEST");
    expect(result!.message).toContain("repoUrl");
  });

  it("returns error for missing branch", () => {
    const result = validateCreateRequest({ ...validRequest, branch: "" } as CreateSandboxRequest);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("BAD_REQUEST");
    expect(result!.message).toContain("branch");
  });

  it("returns error for missing worktreeBranch", () => {
    const result = validateCreateRequest({
      ...validRequest,
      worktreeBranch: "",
    } as CreateSandboxRequest);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("BAD_REQUEST");
    expect(result!.message).toContain("worktreeBranch");
  });

  it("returns error for whitespace-only repoUrl", () => {
    const result = validateCreateRequest({
      ...validRequest,
      repoUrl: "   ",
    } as CreateSandboxRequest);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("BAD_REQUEST");
  });
});

// ---------------------------------------------------------------------------
// validateExecuteRequest
// ---------------------------------------------------------------------------
describe("validateExecuteRequest", () => {
  const validRequest: ExecuteSandboxRequest = {
    taskPrompt: "do something",
  } as ExecuteSandboxRequest;

  it("returns null for valid request", () => {
    expect(validateExecuteRequest(validRequest)).toBeNull();
  });

  it("returns error for missing taskPrompt", () => {
    const result = validateExecuteRequest({
      ...validRequest,
      taskPrompt: "",
    } as ExecuteSandboxRequest);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("BAD_REQUEST");
    expect(result!.message).toContain("taskPrompt");
  });

  it("returns error for negative timeoutMs", () => {
    const result = validateExecuteRequest({
      taskPrompt: "x",
      timeoutMs: -1,
    } as ExecuteSandboxRequest);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("timeoutMs");
  });

  it("returns error for zero timeoutMs", () => {
    const result = validateExecuteRequest({
      taskPrompt: "x",
      timeoutMs: 0,
    } as ExecuteSandboxRequest);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("timeoutMs");
  });

  it("returns error for Infinity timeoutMs", () => {
    const result = validateExecuteRequest({
      taskPrompt: "x",
      timeoutMs: Infinity,
    } as ExecuteSandboxRequest);
    expect(result).not.toBeNull();
  });

  it("returns null for valid positive timeoutMs", () => {
    const result = validateExecuteRequest({
      taskPrompt: "do it",
      timeoutMs: 5000,
    } as ExecuteSandboxRequest);
    expect(result).toBeNull();
  });

  it("returns null when timeoutMs is not provided", () => {
    const result = validateExecuteRequest({ taskPrompt: "do it" } as ExecuteSandboxRequest);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// generateTerminalToken + validateTerminalToken
// ---------------------------------------------------------------------------
describe("terminal token HMAC", () => {
  const SECRET = "test-secret-key";
  const SANDBOX_ID = "sbx-12345";

  it("generates a token in timestamp:hex format", async () => {
    const token = await generateTerminalToken(SANDBOX_ID, SECRET);
    expect(token).toMatch(/^\d+:[a-f0-9]+$/);
  });

  it("validates a freshly generated token", async () => {
    const token = await generateTerminalToken(SANDBOX_ID, SECRET);
    const valid = await validateTerminalToken(token, SANDBOX_ID, SECRET);
    expect(valid).toBe(true);
  });

  it("rejects a token with wrong sandbox ID", async () => {
    const token = await generateTerminalToken(SANDBOX_ID, SECRET);
    const valid = await validateTerminalToken(token, "different-id", SECRET);
    expect(valid).toBe(false);
  });

  it("rejects a token with wrong secret", async () => {
    const token = await generateTerminalToken(SANDBOX_ID, SECRET);
    const valid = await validateTerminalToken(token, SANDBOX_ID, "wrong-secret");
    expect(valid).toBe(false);
  });

  it("rejects a malformed token without colon", async () => {
    const valid = await validateTerminalToken("notavalidtoken", SANDBOX_ID, SECRET);
    expect(valid).toBe(false);
  });

  it("rejects an expired token", async () => {
    // Manually create a token with an old timestamp
    const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 min ago, TTL is 5 min
    const payload = `${SANDBOX_ID}:${oldTimestamp}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const expiredToken = `${oldTimestamp}:${hex}`;

    const valid = await validateTerminalToken(expiredToken, SANDBOX_ID, SECRET);
    expect(valid).toBe(false);
  });

  it("rejects token with empty signature", async () => {
    const token = `${Date.now()}:`;
    const valid = await validateTerminalToken(token, SANDBOX_ID, SECRET);
    expect(valid).toBe(false);
  });

  it("rejects token with non-numeric timestamp", async () => {
    const valid = await validateTerminalToken("abc:deadbeef", SANDBOX_ID, SECRET);
    expect(valid).toBe(false);
  });
});
