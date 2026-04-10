# Foundry

An agentic delivery platform. Feed it plans and conversations — it decomposes them into structured requirements, reasons about implementation, provisions AI sandboxes, and ships code to repos.

Solo founder build by [Quintin Henry](mailto:qdhenry@gmail.com). Alpha (v0.1.0). Open source.

**[Documentation](https://docs.foundryworks.com)** | **[Contributing](CONTRIBUTING.md)** | **[Security](SECURITY.md)**

---

## What this is, honestly

Foundry is me trying to figure out what the future of idea-to-implementation looks like.

The gap between having a plan and having working software is closing faster than most people realize. AI agents that can hold full project context, break down complex requirements, spin up sandboxed environments, generate production code, and push PRs autonomously — that's not theoretical anymore. I'm building it.

This is 100% vibe-engineered. Every line of code was written with Claude. The majority of the files in this repository — I never looked at. Maybe a few CSS tweaks. That's the honest version of what this is.

But "vibe-engineered" doesn't mean unthought — it means the human contribution shifted. I didn't type the implementation. I made the decisions. Which abstractions. How to model the data. Where the domain boundaries fall. What the sandbox lifecycle should look like. How auth cascades through a multi-tenant system. Those are judgment calls, and they're the part that actually matters.

AI is unlocking the ability to test ideas at the speed of thought. For better or worse. "For better" means you can explore an architectural hypothesis in an afternoon instead of a sprint — stand up 55 tables, a 4,000-line state machine, and a multi-process distributed system in weeks and actually evaluate whether the ideas hold. "For worse" means you accumulate complexity just as fast. A 2,800-line schema. A 4,100-line orchestrator. Twelve unmerged branches. 28% test coverage. You can build yourself into corners at machine speed if you're not paying attention.

I tried to be principled about it. Some of those decisions have careful reasoning (documented below). Some were instinct calls validated by building. Some are just debt I accumulated because velocity felt more important than hygiene in week two. I'm being honest about which is which.

## What it actually does

Foundry is engagement-type agnostic — platform migrations, greenfield builds, system integrations, ongoing product dev. Reference client is AcmeCorp (118 requirements, 8 skills, 7 workstreams) running through the full pipeline.

**Delivery pipeline:** Requirements flow in from documents, recordings, conversations. Foundry structures them into a knowledge graph — skills, workstreams, tasks, risk assessments. AI agents reason about the full context, not one requirement in isolation. How it relates to every other requirement. Which repos it touches. What design constraints apply. What the verification criteria should be.

**Sandbox execution:** Provisions ephemeral Docker containers on Cloudflare with full Claude Code environments. The sandbox gets requirement context, codebase, design tokens, skill instructions. Generates code. Verifies it. Pushes to a branch. Humans review the PR. 10-stage state machine handles the full lifecycle.

**Observability:** AI agents doing autonomous work need to be watched. Every operation is tracked — model, tokens, acceptance rate, failures. Agent Activity dashboard groups everything by requirement so you can trace intake through implementation.

**Integrations:** GitHub App (repos, PRs, webhooks), Atlassian OAuth (Jira, Confluence), Google Drive (document import), Clerk (multi-tenant auth, row-level security on every query).

## The opinions

Not all of these have essays behind them — some were instinct calls that held up. All are open to challenge.

**Delivery knowledge is the moat, not code generation.** Most AI coding tools treat generation as the hard problem. It's not. The hard problem is structuring the context that makes generation useful — which requirements map to which workstreams, what the design constraints are, which repos own what. Foundry is a delivery knowledge platform first.

**Convex over Postgres.** Reactive queries, real-time subscriptions, server functions co-located with schema, document model that maps cleanly to the domain. Tradeoff is lock-in and the mutation/action boundary (mutations can't call Node APIs). Worth it for velocity and the real-time UX.

**Clerk orgs as tenancy.** `assertOrgAccess()` on every query and mutation. Row-level security by default. The alternative was building a custom auth layer — exactly the kind of undifferentiated work that kills solo founder projects.

**Human review queues, not auto-approval.** Codebase analysis runs Claude against connected repos to map requirement-to-implementation status. Results go through a review queue. Batch approve/reject. 90% accuracy means the 10% that's wrong could be costly. The queue builds confidence in AI judgment over time.

**Design context cascades then snapshots.** Tokens cascade program → workstream → requirement with merge semantics. When a task is created, context is snapshotted and frozen. Sandboxes get the snapshot, not the live cascade. Design evolves; in-flight sandboxes stay stable.

**Durable event buffer for webhooks.** Store raw event → `runAfter(0)` for async processing → return 200 immediately. Failed ops get exponential backoff (5 attempts, 1h cap). This pattern appears everywhere webhooks are consumed. Only sane way to handle third-party events in serverless.

**All feature UI in `packages/ui/`, not `apps/web/`.** Page files are 3–7 line wrappers. This enables the Tauri desktop app to share every component without forking. Add logic to a page file and you break the shared component model.

## Shape

```
55+ tables across 6 domains (2,834-line schema)
547  UI components in packages/ui/
52   app routes
285  Convex backend files
4,152-line sandbox orchestrator
```

### Stack

| Layer    | What                                                |
| -------- | --------------------------------------------------- |
| Frontend | Next.js 16 + React 19 + TypeScript                  |
| UI       | Untitled UI React + Tailwind CSS 4.1                |
| Backend  | Convex (reactive BaaS, real-time subscriptions)     |
| Auth     | Clerk (organizations = tenants, JWT validation)     |
| AI       | Claude API (Opus 4.6 / Sonnet 4.5) via Agent Worker |
| Sandbox  | Cloudflare Workers + Durable Objects + Docker       |
| Desktop  | Tauri 2 (Rust + Vite, shared @foundry/ui)           |
| Deploy   | Vercel + Convex Cloud + Cloudflare Workers          |

### Architecture

```
Browser / Desktop
  └── WebSocket ──→ Convex Cloud
                      ├── Schema (55+ tables, 6 domains)
                      ├── Server functions (queries, mutations, actions)
                      ├── AI actions (context assembly → Claude API)
                      └── Webhooks (GitHub, Atlassian, Clerk)
                              │
                    HTTP ──────┤
                              │
                    Agent Worker (Cloudflare)
                      └── Hono + Anthropic SDK
                          /analyze-requirement
                          /analyze-task-subtasks
                              │
                    Sandbox Worker (Cloudflare)
                      └── Durable Objects + Docker
                          Ephemeral Claude Code environments
                              │
                    External Services
                      ├── GitHub App (repos, PRs, webhooks)
                      ├── Clerk (auth, orgs, JWTs)
                      └── Claude API (3-tier model deployment)
```

### Project structure

```
apps/
  web/                    # Next.js frontend (52 routes, thin wrappers)
  desktop/                # Tauri 2 desktop app
  csuite/                 # Executive dashboard variant
packages/
  ui/                     # All feature UI (547 files, 34 domains)
  types/                  # Shared TypeScript types
convex/                   # Backend (55+ tables, server functions, AI actions)
  schema.ts               # 2,834-line data model
  sandbox/
    orchestrator.ts       # 4,152-line sandbox lifecycle state machine
  sourceControl/          # GitHub App integration
  atlassian/              # Jira/Confluence integration
agent-worker/             # Cloudflare Worker — AI analysis routes (Hono)
agent-service/            # Express 5 sidecar (legacy, migrating to agent-worker)
sandbox-worker/           # Cloudflare Worker — Durable Objects + Docker
```

## What works

Core delivery pipeline is stable, running end-to-end:

- Requirements → skills → tasks → workstreams pipeline
- Sandbox execution (10-stage provisioning, Docker, auto-commit)
- Agent Activity dashboard with audit trail
- Design context pipeline (AI vision analysis, cascade/snapshot)
- Repo picker across tasks and workstreams
- Task verification pipeline
- Google Drive import
- Service resilience (auto-reconnect, health monitoring)
- Billing (3 tiers)
- Biome enforcement (pre-commit + PostToolUse hooks)
- GitHub App + Atlassian integrations
- Clerk multi-tenant auth with row-level security

## What doesn't (yet)

- **Test coverage is 28%.** 153 of 261 source files in `apps/web` have zero tests. There's a spec for 4-agent parallel strategy to bring it to 90%. Not executed yet.
- **The orchestrator is a monolith.** 4,152 lines — state machine, provisioning, fleet management, auto-commit all in one file. Works, but it's the biggest maintainability risk.
- **Schema needs splitting.** 2,834 lines, changed 10 times in the last two-week window. Should be domain fragments that merge at build time.
- **12 stale branches.** Merged via different names, never cleaned up.
- **Codebase analysis still on `development`.** The newest feature — AI requirement-to-implementation mapping with review queue — hasn't been promoted to main.

## 10 things to hold in your head

If you're going to work in this codebase:

1. **Every query must use `.withIndex()`.** Never `.filter()`. Full table scans kill reactive performance.
2. **Clerk wraps Convex, never the reverse.** Break the provider nesting and auth fails silently.
3. **All feature UI in `packages/ui/`.** Page files are thin wrappers. Add logic to a page and you break desktop sharing.
4. **Mutations can't call Node.js APIs.** Only actions. Shared utils with `"use node"` will fail in mutations.
5. **`assertOrgAccess()` on everything.** Skip it → cross-tenant data leaks. Exception: health checks (run before Clerk init).
6. **`params`/`searchParams` are Promises in Next.js 16.** Must `await`. Same for `headers()`, `cookies()`.
7. **`"skip"` token on `useQuery` when auth hasn't resolved.** Prevents unauthenticated flashes.
8. **`ALLOWED_TRANSITIONS` governs sandbox lifecycle.** Add a transition without updating the map → silently rejected.
9. **Webhooks: store raw → `runAfter(0)` → return 200.** Exponential backoff on failures (5 attempts, 1h cap).
10. **Design context cascades then snapshots.** Don't mutate a snapshot expecting sandboxes to see the change.

## Getting started

### Prerequisites

- Node.js 20+
- [Bun](https://bun.sh/)
- [Zellij](https://zellij.dev/) (optional, for multi-pane dev)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- Cloudflare account with Containers access

### Install

```bash
bun install
cd sandbox-worker && bun install && cd ..
```

### Environment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full reference. Short version:

| Where            | What                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.env.local`     | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`                                |
| Convex Dashboard | `ANTHROPIC_API_KEY`, `CLERK_WEBHOOK_SECRET`, `SANDBOX_WORKER_URL`, `SANDBOX_API_SECRET`, `GITHUB_WEBHOOK_SECRET` |
| Wrangler Secrets | `SANDBOX_API_SECRET` (must match Convex)                                                                         |

### Run

```bash
bun run dev:zellij     # All services (recommended)

# Or individually
bun run dev:web        # Next.js on :3000
bun run dev:convex     # Convex backend
bun run dev:agent      # Agent service on :3001
bun run dev:worker     # Sandbox worker on :8788
```

### Deploy

```bash
vercel deploy                              # Frontend
bunx convex deploy                         # Backend
cd agent-worker && bunx wrangler deploy    # AI analysis routes
cd sandbox-worker && bunx wrangler deploy  # Sandbox execution
```

## Links

- [Documentation](https://docs.foundryworks.com) — Self-host guides, architecture walkthroughs, API reference, troubleshooting
- [Deployment Guide](./DEPLOYMENT.md) — Production deployment across Vercel, Convex, Cloudflare
- [Contributing](./CONTRIBUTING.md) — How to propose changes
- [Code of Conduct](./CODE_OF_CONDUCT.md) — Community standards
- [Security Policy](./SECURITY.md) — Reporting vulnerabilities
- [Bespoke Agentics](https://bespokeagentics.ai/) — The broader thesis

## License

Foundry is licensed under the [Apache License, Version 2.0](./LICENSE). See the [NOTICE](./NOTICE) file for attribution.
