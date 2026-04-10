# Contributing to Foundry

Thanks for considering contributing to Foundry. This document covers everything you need to go from clone to merged PR.

## Quick start

```bash
# Prerequisites: Bun 1.1+, Node 20+, a Convex account (free tier works)
git clone https://github.com/foundry-platform/foundry.git
cd foundry
bun install
cp .env.example .env.local   # Fill in your Convex + Clerk keys (see SELF-HOSTING.md)
```

You need at minimum two terminal sessions to develop:

```bash
# Terminal 1 — Convex backend (real-time sync, hot reload)
bun run dev:convex

# Terminal 2 — Next.js frontend
bun run dev
```

For sandbox and agent features, you'll also need:

```bash
# Terminal 3 — Agent service (AI inference, port 3001)
bun run dev:agent

# Terminal 4 — Sandbox worker (Cloudflare local dev, port 8788)
bun run dev:worker
```

Or run everything at once with Zellij: `bun run dev:zellij`

The app will be at `http://localhost:3000`.

## Project structure

All feature UI lives in `packages/ui/src/`. App route pages in `apps/web/` are thin wrappers that import from `@foundry/ui`:

```
apps/web/          → Route pages (thin wrappers only)
apps/desktop/      → Tauri 2 desktop app (shares @foundry/ui)
packages/ui/       → All feature UI (@foundry/ui)
convex/            → Backend: schema, queries, mutations, actions
agent-service/     → Express AI inference sidecar (local dev)
agent-worker/      → Cloudflare Worker AI inference (production)
sandbox-worker/    → Cloudflare Worker + Durable Objects sandbox execution
```

## Code style

We use [Biome](https://biomejs.dev/) for linting and formatting. Configuration is in `biome.json`. The pre-commit hook (via Lefthook) runs Biome automatically on staged files — if it fails, fix the issues before committing.

Key style rules:

- 2-space indentation, double quotes, semicolons, trailing commas
- Imports are auto-organized by Biome
- `noExplicitAny`, `noUnusedVariables`, `noUnusedImports` are warnings (not blocking, but please fix them)
- All other recommended rules are errors

Run manually:

```bash
bun run check          # Check lint + format (no changes)
bun run check:fix      # Auto-fix everything Biome can fix
bun run typecheck      # TypeScript type checking across all workspaces
```

## Convex patterns

If you're working on backend code, read `convex/_generated/ai/guidelines.md` first. Key rules:

**Always use indexes.** Every query must use `.withIndex()`. Never use `.filter()` — it causes full table scans and breaks reactive performance. If you need a new query pattern, add the index to `schema.ts`.

**Row-level security is mandatory.** Every query and mutation that touches tenant data must call `assertOrgAccess(ctx, orgId)`. No exceptions. This is the security boundary for multi-tenancy.

**Mutations vs. actions.** Mutations are transactional but can't call external APIs or Node.js libraries. Actions can call anything but aren't transactional. Use mutations for data changes, actions for AI calls and external integrations.

## Making a PR

1. **Check for an existing issue.** If there isn't one for your change, open one first. This saves everyone time if the approach needs discussion.

2. **Branch from `main`.** Use descriptive branch names: `fix/sandbox-timeout`, `feat/ollama-provider`, `docs/self-hosting-postgres`.

3. **Keep PRs focused.** One concern per PR. A 200-line PR that does one thing gets reviewed in a day. A 1,500-line PR that does three things sits for a week.

4. **Write a clear description.** What does this change? Why? How did you test it? Screenshots for UI changes.

5. **Make sure CI passes.** The PR checks run:
   - Biome lint + format
   - TypeScript type checking (all workspaces)
   - Convex schema validation

   A ready-to-use GitHub Actions workflow lives at `.github/ci.yml.template`.
   First-time maintainers should copy it to `.github/workflows/ci.yml` (the
   workflow file is shipped as a template because the repository's GitHub App
   integration doesn't have permission to add workflow files directly).

6. **Respond to review feedback.** We aim to review PRs within 48 hours on weekdays. If a reviewer requests changes, please respond within a reasonable timeframe or let us know if you need help.

## Types of contributions we especially welcome

- **Provider adapters**: Support for additional AI providers (OpenAI, Ollama, local LLMs), auth providers, or source control providers (GitLab, Gitea)
- **Bug fixes**: Especially around sandbox lifecycle, real-time sync, or edge cases in the task decomposition pipeline
- **Documentation**: Architecture explanations, self-hosting guides for different environments, tutorials
- **Tests**: Coverage is currently low — any test improvements are valuable
- **Accessibility**: The UI needs a11y audit and improvements
- **Performance**: Convex query optimization, frontend render performance, bundle size reduction

## What to avoid

- **Don't refactor for style.** If you're fixing a bug, fix the bug. Don't reorganize the file while you're there.
- **Don't add dependencies without discussion.** Open an issue first. The dependency bar is high — we prefer fewer, well-maintained dependencies.
- **Don't change the schema without discussion.** Schema changes affect every tenant. Always open an issue to discuss data model changes before implementation.

## Setting up test data

The reference dataset is AcmeCorp (118 requirements, 8 skills, 7 workstreams). To seed test data:

```bash
# After Convex is running:
bunx convex run seed:seedAcmeCorp '{"orgId": "<your-org-id>"}'
```

This creates a program with realistic delivery data you can use for development and testing.

## Running tests

```bash
bun run test              # Run all tests once
bun run test:watch        # Watch mode
bun run test:coverage:web # Coverage report for web app
```

## Getting help

- **GitHub Issues**: For bugs, feature requests, and design discussions
- **GitHub Discussions**: For questions, ideas, and community conversation

## License

Foundry is licensed under the [Apache License, Version 2.0](./LICENSE). By contributing to Foundry, you agree that your contributions will be licensed under the same Apache-2.0 license. See the [NOTICE](./NOTICE) file for attribution.
