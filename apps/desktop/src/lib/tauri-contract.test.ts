import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { TAURI_SANDBOX_COMMAND } from "./tauri-bridge";

const TAURI_LIB_PATH_CANDIDATES = [
  path.resolve(process.cwd(), "apps/desktop/src-tauri/src/lib.rs"),
  path.resolve(process.cwd(), "src-tauri/src/lib.rs"),
];

function resolveTauriLibPath(): string {
  const match = TAURI_LIB_PATH_CANDIDATES.find((candidatePath) =>
    existsSync(candidatePath)
  );
  if (!match) {
    throw new Error("Could not locate apps/desktop/src-tauri/src/lib.rs");
  }
  return match;
}

function readTauriLibSource(): string {
  return readFileSync(resolveTauriLibPath(), "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("desktop tauri command contract parity", () => {
  it("includes convex sync bootstrap command", () => {
    expect(TAURI_SANDBOX_COMMAND.configureConvexSync).toBe("configure_convex_sync");
  });

  it("keeps TAURI_SANDBOX_COMMAND values unique", () => {
    const commands = Object.values(TAURI_SANDBOX_COMMAND);

    expect(new Set(commands).size).toBe(commands.length);
  });

  it("registers every bridge command in tauri::generate_handler", () => {
    const source = readTauriLibSource();
    const generateHandlerMatch = source.match(/generate_handler!\[([\s\S]*?)\]\s*\)/);

    expect(generateHandlerMatch).not.toBeNull();
    const invokeRegistrationBlock = generateHandlerMatch![1];

    for (const commandName of Object.values(TAURI_SANDBOX_COMMAND)) {
      expect(invokeRegistrationBlock).toMatch(
        new RegExp(`commands::[a-z_]+::${escapeRegExp(commandName)}\\b`)
      );
    }
  });
});
