#!/usr/bin/env node

/**
 * File watcher that triggers `claude -p` on changes.
 *
 * Usage:
 *   node scripts/watch-files.mjs <path> <prompt> [--glob '*.tsx'] [--debounce 500]
 *
 * The prompt can include {{file}} which gets replaced with the changed file path.
 */

import { watch } from "chokidar";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// --- CLI arg parsing ---

const args = process.argv.slice(2);

function flag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const val = args[idx + 1];
  args.splice(idx, 2);
  return val;
}

const globPattern = flag("glob");
const debounceMs = Number(flag("debounce") ?? 500);

// After flags are consumed, positional args remain
const watchPath = args[0];
const promptTemplate = args[1];

if (!watchPath || !promptTemplate) {
  console.error(
    "Usage: node scripts/watch-files.mjs <path> <prompt> [--glob '*.tsx'] [--debounce 500]"
  );
  console.error("");
  console.error("  <path>       File or directory to watch");
  console.error(
    "  <prompt>     Claude prompt (use {{file}} for changed file path)"
  );
  console.error("  --glob       Glob filter (e.g. '*.tsx')");
  console.error("  --debounce   Debounce delay in ms (default: 500)");
  process.exit(1);
}

const resolvedPath = resolve(watchPath);

// --- Debounce logic ---

let timer = null;
const pending = new Set();

function flush() {
  const files = [...pending];
  pending.clear();

  for (const file of files) {
    const prompt = promptTemplate.replace(/\{\{file\}\}/g, file);
    const ts = new Date().toISOString();
    console.log(`[${ts}] Running claude for: ${file}`);
    try {
      const output = execSync(`claude -p '${prompt.replace(/'/g, "'\\''")}' --print`, {
        encoding: "utf-8",
        timeout: 120_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      console.log(output);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.error(`[${ts}] Error: 'claude' CLI not found. Install it first.`);
      } else {
        console.error(`[${ts}] Error running claude:`, err.message);
      }
    }
  }
}

function schedule(filePath) {
  pending.add(filePath);
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, debounceMs);
}

// --- Watcher ---

const watcherOpts = {
  ignoreInitial: true,
  ignored: /(^|[/\\])\../,
};

const watcher = watch(
  globPattern ? `${resolvedPath}/${globPattern}` : resolvedPath,
  watcherOpts
);

const ts = new Date().toISOString();
console.log(`[${ts}] Watching: ${resolvedPath}`);
if (globPattern) console.log(`[${ts}] Glob filter: ${globPattern}`);
console.log(`[${ts}] Debounce: ${debounceMs}ms`);
console.log(`[${ts}] Prompt template: ${promptTemplate}`);
console.log(`[${ts}] Waiting for changes...\n`);

watcher.on("change", (fp) => schedule(fp));
watcher.on("add", (fp) => schedule(fp));
watcher.on("error", (err) => console.error("Watcher error:", err.message));

process.on("SIGINT", () => {
  console.log("\nShutting down watcher...");
  watcher.close();
  process.exit(0);
});
