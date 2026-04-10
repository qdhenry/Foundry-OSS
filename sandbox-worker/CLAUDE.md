# sandbox-worker/
Cloudflare Worker + Durable Objects + Docker. Ephemeral AI sandbox execution (flagship feature).

## Arch
```
Convex action -> Worker (index.ts, bearer auth) -> SessionStore DO (session-store.ts)
  -> @cloudflare/sandbox Docker container -> Claude Code CLI (via sdk-runner-template.ts)
```

## Routes (all require Bearer SANDBOX_API_SECRET except /health and terminal)
POST /sandbox/create | POST /:id/execute | GET /:id/logs (poll/SSE)
GET /:id/fs/list | GET /:id/fs/read | POST /:id/fs/write | POST /:id/message
POST /:id/finalize | GET /:id/terminal (WebSocket, HMAC auth) | DELETE /:id
GET /health — no auth

## SessionStore DO (~3600 lines)
SQL storage: session_meta (key-value) + logs (append-only, indexed by level+sequence)
Lifecycle: provisioning->cloning->ready->executing->finalizing->completed|failed
Auto-cleanup via DO alarm (TTL: 5-60 min, default 15 min)

## 10-Stage Setup
containerProvision->systemSetup->authSetup->claudeConfig->gitClone->depsInstall->mcpInstall->workspaceCustomization->healthCheck->ready
Each stage: pending|running|completed|failed|skipped with metadata (startedAt, completedAt, error)

## Streaming
Poll (HTTP+cursor), SSE (log/status/heartbeat events, 15s heartbeat, 10min timeout), WebSocket (terminal, HMAC token 5min TTL)

## Key Behaviors
- Auto-commit via PostToolUse hooks (5s debounce)
- TTL: 15min default (5-60 configurable), DO alarm auto-cleanup
- Fallback in-memory mode when @cloudflare/sandbox unavailable
- Terminal WebSocket uses HMAC (not bearer) since browsers can't set Auth headers on WebSocket
- Best-effort audit recording — errors silently caught, never break orchestration
- SDK runner template (sdk-runner-template.ts) generates bash script for Claude CLI subprocess

## Deployment
Wrangler: name=migration-sandbox-worker, standard-4 instances, max 20 containers
DOs: Sandbox (container mgmt), SessionStore (session state)
Tail worker (tail-worker.ts) → observability via wrangler-tail.jsonc

## Key Files
index.ts (routing + auth) | session-store.ts (DO, ~3600 LOC) | sdk-runner-template.ts (Claude CLI script gen) | Dockerfile (@cloudflare/sandbox image)

## Cmd
Dev: `bun run dev` | Deploy: `bun run deploy` | Types: `bun run typecheck`
Env: SANDBOX_API_SECRET (auth), SANDBOX_LOG_LEVEL, SANDBOX_LOG_FORMAT
