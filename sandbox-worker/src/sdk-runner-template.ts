/**
 * SDK Runner Script Template
 *
 * This module exports the source code for a Node.js script that gets written
 * into the sandbox container at runtime. The script uses the Claude Agent SDK
 * to execute tasks with proper event streaming, session management, and hook
 * support — replacing the raw CLI invocation.
 *
 * The script communicates with the Durable Object by writing JSONL events to
 * an output file (same polling pattern as the CLI approach), and optionally
 * reads multi-turn messages from stdin for interactive sessions.
 */

export function buildSdkRunnerScript(options: {
  outputFile: string;
  mode: "query" | "session";
  model?: string;
  systemPromptAppend?: string;
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
  hookConfig?: {
    convexUrl: string;
    hookSecret: string;
    sandboxId: string;
  };
}): string {
  const { outputFile, mode, model, systemPromptAppend, mcpServers, hookConfig } = options;

  // Serialize config values that need to be embedded in the script
  const modelStr = model ? JSON.stringify(model) : '"claude-sonnet-4-5-20250929"';
  const mcpServersStr = mcpServers ? JSON.stringify(mcpServers) : "{}";
  const systemPromptAppendStr = systemPromptAppend
    ? JSON.stringify(systemPromptAppend)
    : "undefined";

  // Build hook callbacks if a convex URL is configured
  const hookBlock = hookConfig
    ? `
  let lastPushTime = 0;
  const hookCallbacks = {
    PostToolUse: [{
      matcher: "Edit|Write|Bash",
      hooks: [async (input) => {
        // Report event to Convex
        try {
          await fetch(${JSON.stringify(hookConfig.convexUrl)} + "/api/sandbox/hook-events", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + ${JSON.stringify(hookConfig.hookSecret)},
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...input,
              session_id: ${JSON.stringify(hookConfig.sandboxId)},
              event_type: "PostToolUse",
            }),
          });
        } catch {}

        // Auto-push file changes (debounced, fire-and-forget)
        try {
          const now = Date.now();
          if (now - lastPushTime > 5000) {
            lastPushTime = now;
            const { exec } = await import("child_process");
            exec('cd /workspace && git add . && git diff --cached --quiet || (git commit -m "wip: auto-sync" && git push) 2>/dev/null',
              { timeout: 30000 });
          }
        } catch {}

        return { continue: true };
      }],
    }],
    Stop: [{
      hooks: [async (input) => {
        try {
          await fetch(${JSON.stringify(hookConfig.convexUrl)} + "/api/sandbox/hook-events", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + ${JSON.stringify(hookConfig.hookSecret)},
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...input,
              session_id: ${JSON.stringify(hookConfig.sandboxId)},
              event_type: "Stop",
            }),
          });
        } catch {}
        return { continue: true };
      }],
    }],
  };`
    : "const hookCallbacks = undefined;";

  if (mode === "session") {
    return `#!/usr/bin/env node
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";
import { createInterface } from "readline";
import { appendFileSync, writeFileSync } from "fs";

const OUTPUT_FILE = ${JSON.stringify(outputFile)};
writeFileSync(OUTPUT_FILE, "");

function emit(event) {
  appendFileSync(OUTPUT_FILE, JSON.stringify(event) + "\\n");
}

async function main() {
  emit({ type: "system", subtype: "runner_started", timestamp: new Date().toISOString() });

  const session = unstable_v2_createSession({
    model: ${modelStr},
    permissionMode: "bypassPermissions",
  });

  emit({ type: "system", subtype: "session_created", session_id: session.sessionId || "pending" });

  // Read the initial prompt from argv
  const initialPrompt = process.argv[2] || "";
  if (initialPrompt) {
    await session.send(initialPrompt);
  }

  // Process stream events in background
  const streamLoop = (async () => {
    for await (const event of session.stream()) {
      emit(event);
      // Capture session ID from init message
      if (event.type === "system" && event.subtype === "init" && event.session_id) {
        emit({ type: "system", subtype: "session_id_captured", claude_session_id: event.session_id });
      }
    }
  })();

  // Listen for follow-up messages on stdin (interactive mode)
  const rl = createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.type === "user_message") {
        emit({ type: "system", subtype: "user_message_received", content: msg.content });
        await session.send(msg.content);
      } else if (msg.type === "close") {
        session.close();
        rl.close();
      }
    } catch {
      // Treat raw text as a user message
      emit({ type: "system", subtype: "user_message_received", content: trimmed });
      await session.send(trimmed);
    }
  });

  await streamLoop;
  emit({ type: "result", subtype: "session_ended" });
  process.exit(0);
}

main().catch((err) => {
  emit({ type: "result", subtype: "error_during_execution", is_error: true, errors: [String(err)] });
  process.exit(1);
});
`;
  }

  // mode === "query"
  return `#!/usr/bin/env node
import { query } from "@anthropic-ai/claude-agent-sdk";
import { appendFileSync, writeFileSync } from "fs";

const OUTPUT_FILE = ${JSON.stringify(outputFile)};
writeFileSync(OUTPUT_FILE, "");

function emit(event) {
  appendFileSync(OUTPUT_FILE, JSON.stringify(event) + "\\n");
}

${hookBlock}

async function main() {
  emit({ type: "system", subtype: "runner_started", timestamp: new Date().toISOString() });

  const prompt = process.argv[2] || "";
  if (!prompt) {
    emit({ type: "result", subtype: "error_during_execution", is_error: true, errors: ["No prompt provided"] });
    process.exit(1);
  }

  const mcpServers = ${mcpServersStr};
  const systemPromptAppend = ${systemPromptAppendStr};

  const q = query({
    prompt,
    options: {
      model: ${modelStr},
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      cwd: process.cwd(),
      ...(systemPromptAppend ? {
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: systemPromptAppend,
        },
      } : {}),
      ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
      ...(hookCallbacks ? { hooks: hookCallbacks } : {}),
      settingSources: ["project"],
      persistSession: false,
    },
  });

  let sessionId = null;

  for await (const event of q) {
    emit(event);

    // Capture session ID from init message
    if (event.type === "system" && event.subtype === "init" && event.session_id) {
      sessionId = event.session_id;
      emit({ type: "system", subtype: "session_id_captured", claude_session_id: event.session_id });
    }

    // Log result events for visibility
    if (event.type === "result") {
      emit({ type: "system", subtype: "query_complete", session_id: sessionId });
    }
  }

  process.exit(0);
}

main().catch((err) => {
  emit({ type: "result", subtype: "error_during_execution", is_error: true, errors: [String(err)] });
  process.exit(1);
});
`;
}
