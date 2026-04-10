# agent-worker/
Cloudflare Worker for production AI analysis. Replaces Express agent-service in prod.

## Cmd
Dev: `bun run dev` | Deploy: `wrangler deploy` | Types: `bun run typecheck` | Test: `bun test`

## Routes (all POST unless noted, require x-org-id header + Bearer auth)

**Phase A — No AI:** GET /auth/status | GET /atlassian/connection-health
**Phase B — External HTTP only:** POST /atlassian/oauth
**Phase C — AI, no thinking:** /continuous-discovery | /refine-requirement | /summarize-discovery
**Phase D — AI + thinking:** /decompose-task | /evaluate-risks | /evaluate-gate | /plan-sprint
**Phase E — AI + thinking, codebase:** /analyze-codebase | /codebase-chat | /analyze-requirement | /analyze-task-subtasks
**Phase F — AI delivery orchestration:** /generate-team | /dispatch-agent

GET /health — No auth required.

## Auth
Bearer token via AGENT_SERVICE_SECRET (timing-safe SHA-256 comparison via `crypto.subtle.digest`). /health skips auth.

## AI Pattern
runAgentQuery<T>(zodSchema, {prompt, systemPrompt, maxThinkingTokens, model}, apiKey)
Uses @anthropic-ai/sdk (standard HTTP, Workers-compatible). No subprocess SDK.
Model: claude-sonnet-4-5-20250929. Max tokens: 16,384 (thinking) / 8,192 (no thinking).
Extracts JSON via regex, validates Zod.

## Stack
Hono router (~14KB), @anthropic-ai/sdk, zod@4, Cloudflare Workers (V8 + nodejs_compat)

## Middleware
requestLogger -> orgIdMiddleware -> auditMiddleware -> costTrackingMiddleware + global onError handler

## Key Differences from agent-service
- Standard Anthropic SDK (HTTP) instead of Claude Agent SDK (subprocess)
- Bearer token auth instead of filesystem/OAuth detection
- Env vars from Wrangler secrets instead of process.env
- No Express, no Node.js filesystem APIs
- No MCP tools (subprocess not available in Workers)
