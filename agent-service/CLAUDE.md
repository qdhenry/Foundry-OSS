# agent-service
Express 5 + Claude Agent SDK sidecar on port 3001. Stateless AI analysis (local dev only).

## Cmd
Dev: `bun run dev` | Build: `bun run build` | Start: `bun start` | Test: `bun test`

## Routes

**AI routes (POST, require x-org-id header):**
/continuous-discovery | /refine-requirement | /decompose-task
/plan-sprint | /evaluate-risks | /evaluate-gate | /summarize-discovery

**Integration routes:**
/atlassian/oauth | /atlassian/connection-health | /analyze-codebase | /codebase-chat

**Auth routes (no x-org-id required):**
GET /auth/status | POST /auth/api-key (sk-ant- prefix) | DELETE /auth/api-key

**Health:** GET /health (no auth)

## Auth
3-priority: manual .config/auth.json -> ANTHROPIC_API_KEY env -> ~/.claude.json OAuth
Cached 5 min, invalidated on write.

## AI Pattern
runAgentQuery<T>(zodSchema, {prompt, systemPrompt, maxThinkingTokens, model})
Model: claude-sonnet-4-5-20250929. Max tokens: 16,384 (adjusts for thinking).
Streams events, extracts JSON via regex (`/\{[\s\S]*\}/`), validates Zod.
Response includes metadata: inputTokens, outputTokens, totalTokensUsed, processedAt.

## Middleware
json(10mb) -> requestLogger -> auditMiddleware -> costTrackingMiddleware -> errorHandler
Cost tracking intercepts `res.json()` to log token estimates at response time.

## MCP Server (unused)
`src/mcp/convex-mcp-server.ts` — Read-only Convex tools via HTTP POST to `${convexUrl}/api/query`:
get_requirement_context | get_team_members | get_sprint_data | get_active_skills | get_program_context

## Key Facts
- No Convex write-back. Results via HTTP response only.
- In production, agent-worker (Cloudflare) replaces this service
- Convex actions (convex/*Actions.ts) are canonical AI path for persistence
- Deps: @anthropic-ai/claude-agent-sdk, express@5, convex, zod@4
