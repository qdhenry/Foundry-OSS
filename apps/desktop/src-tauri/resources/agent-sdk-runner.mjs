#!/usr/bin/env node

const now = () => new Date().toISOString();

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    return undefined;
  }

  return value;
}

function parseMaxTurns(rawValue) {
  if (rawValue === undefined) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function main() {
  const prompt = (readArg("prompt") ?? "").trim();
  const model = (readArg("model") ?? "claude-sonnet-4-5-20250929").trim();
  const maxTurns = parseMaxTurns(readArg("max-turns"));

  emit({
    event: "init",
    runner: "agent_sdk",
    timestamp: now(),
    model,
    maxTurns,
    pid: process.pid,
  });

  if (!prompt) {
    emit({
      event: "error",
      runner: "agent_sdk",
      timestamp: now(),
      code: "empty_prompt",
      message: "prompt cannot be empty",
    });
    process.exitCode = 2;
    return;
  }

  emit({
    event: "content",
    runner: "agent_sdk",
    timestamp: now(),
    role: "assistant",
    text: `Processing prompt (${prompt.length} chars) with model ${model}.`,
  });

  emit({
    event: "result",
    runner: "agent_sdk",
    timestamp: now(),
    ok: true,
    model,
    maxTurns,
    output: `Agent SDK runner completed prompt processing for: ${prompt}`,
  });
}

main().catch((error) => {
  emit({
    event: "error",
    runner: "agent_sdk",
    timestamp: now(),
    code: "unhandled_exception",
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
