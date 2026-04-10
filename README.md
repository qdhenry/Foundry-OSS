# Foundry

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/qdhenry/Foundry-OSS/actions/workflows/ci.yml/badge.svg)](https://github.com/qdhenry/Foundry-OSS/actions/workflows/ci.yml)

**An AI-native delivery platform that transforms project requirements into production-ready code.**

Foundry converts raw project documents, specifications, and recordings into working software through an automated pipeline of AI-driven requirement extraction, task decomposition, autonomous agent execution, and human review.



https://github.com/user-attachments/assets/b39ec089-792b-48d6-af30-ac63829e0f3a



---

## Overview

Foundry is an open-source platform that explores what software delivery looks like when AI agents handle the majority of the execution work, with humans focused on review, judgment, and oversight. It is designed for teams that want to compress the timeline from requirements to shipped code without sacrificing quality or control.

## Core Capabilities

**AI Discovery.** The platform ingests PDFs, specification documents, videos, images, and recordings, and extracts structured requirements with confidence scoring. It surfaces ambiguity early so teams can resolve unclear scope before implementation begins.

**Autonomous Agent Execution.** Agents write code, run tests, create pull requests, and push to repositories from within isolated sandbox environments. Each task is scoped, measurable, and reviewable before it reaches the main branch.

**Mission Control.** A dashboard layer provides predictive health scoring, dependency detection, and risk signals that surface scheduling issues days before they impact delivery.

**Governance.** Audit trails, row-level security, and configurable review gates are built in, enabling use in environments with compliance requirements.

## Architecture

Foundry is organized into five pipeline stages:

1. **Ingestion** -- Document parsing and content extraction
2. **Discovery** -- AI-driven requirement extraction and confidence scoring
3. **Decomposition** -- Task breakdown and dependency mapping
4. **Execution** -- Autonomous agent code generation in sandboxed environments
5. **Review** -- Human-in-the-loop approval workflows prior to deployment

Each stage is independently modular and can be run, replaced, or extended.

### System Architecture

```
Browser / Desktop App
  |
  v
Next.js 16 (Vercel)          Tauri 2 Desktop
  |                             |
  +-------- @foundry/ui --------+    <-- shared component library
  |
  v
Convex Cloud (reactive BaaS)
  |       |
  v       v
Agent Worker          Sandbox Worker
(Cloudflare)          (Cloudflare + Docker)
  |                     |
  v                     v
Claude API            Ephemeral containers
                      (Claude Code CLI)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5.9 |
| Desktop | Tauri 2 (Rust + Vite + React) |
| UI Components | `@foundry/ui` -- shared library used by both web and desktop |
| Styling | Tailwind CSS 4.1 (CSS-first config) |
| Backend / Database | Convex (reactive document DB, real-time subscriptions, server functions) |
| Auth | Clerk (organizations = tenants, JWT, webhook sync) |
| AI | Claude API (Opus 4.6, Sonnet 4.5) via Convex actions + Cloudflare Workers |
| Sandbox | Cloudflare Workers + Durable Objects + Docker containers |
| Monorepo | Bun workspaces |
| Linting | Biome |
| Deployment | Vercel (web) + Convex Cloud (backend) + Cloudflare (workers) |

### Project Structure

```
apps/
  web/                  Next.js frontend (thin route wrappers)
  desktop/              Tauri 2 desktop app (shares @foundry/ui)
  docs/                 Documentation site (Astro + Starlight)
packages/
  ui/                   @foundry/ui -- all feature UI lives here
  types/                Shared TypeScript types
convex/                 Backend: schema, queries, mutations, AI actions
agent-service/          Express AI sidecar (local development)
agent-worker/           Cloudflare Worker AI inference (production)
sandbox-worker/         Cloudflare Worker + Durable Objects + Docker
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.1+
- [Node.js](https://nodejs.org/) 20+
- A [Convex](https://convex.dev/) account (free tier works)
- A [Clerk](https://clerk.com/) account (free tier works)

### Setup

```bash
git clone https://github.com/qdhenry/Foundry-OSS.git
cd Foundry-OSS
bun install
cp .env.example .env.local   # Fill in your Convex + Clerk keys
```

### Development

You need at minimum two terminal sessions:

```bash
# Terminal 1 -- Convex backend (real-time sync, hot reload)
bun run dev:convex

# Terminal 2 -- Next.js frontend
bun run dev
```

For sandbox and agent features:

```bash
# Terminal 3 -- Agent service (AI inference, port 3001)
bun run dev:agent

# Terminal 4 -- Sandbox worker (Cloudflare local dev, port 8788)
bun run dev:worker
```

Or run everything at once with [Zellij](https://zellij.dev/): `bun run dev:zellij`

The app will be at `http://localhost:3000`.

Full setup and deployment instructions: [foundry.bespokeagentics.ai](https://foundry.bespokeagentics.ai/)

## Contributing

Contributions are welcome. Please review the [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

This project uses [conventional commits](https://www.conventionalcommits.org/). Commit messages are validated locally via a `commit-msg` hook and in CI on pull requests.

## Current Limitations

Foundry is opinionated by design in this early release. Some of these constraints are intentional starting points; others are actively being worked on.

**Claude-only AI.** All AI operations currently require the Anthropic Claude API. The platform uses a three-tier model deployment (Opus for document analysis, Sonnet for agent tasks and skill execution) and relies on Claude-specific features like extended thinking and prompt caching. There is no abstraction layer for alternative providers yet.

**Cloud-dependent backend.** The web application requires Convex Cloud for the database and real-time subscriptions, Clerk for authentication, and Cloudflare Workers for sandbox execution. Self-hosting the full stack on your own infrastructure is not yet supported.

**Desktop app is not at full parity.** The Tauri desktop app shares 100% of the UI components via `@foundry/ui` and supports local sandbox execution without Cloudflare, but several web-only features (GitHub App webhooks, Atlassian integration, collaborative presence) are not yet available in the desktop build. The desktop app is the foundation for local-first and self-hosted workflows, but that path is incomplete.

### Roadmap

These are the high-level directions, not commitments with timelines:

- **LLM-agnostic provider layer** -- Abstraction over the AI backend so teams can use OpenAI, local models (Ollama, llama.cpp), or other providers alongside or instead of Claude
- **Self-hosted deployment** -- First-class support for running the full stack (database, auth, sandbox execution) on your own infrastructure without third-party cloud dependencies
- **Desktop feature parity** -- Bring the desktop app to full parity with the web version, including source control integrations and collaborative features
- **Provider adapters** -- Pluggable integrations beyond GitHub and Atlassian (GitLab, Gitea, Linear, etc.)

Contributions toward any of these directions are welcome. See [Contributing](CONTRIBUTING.md).

## Status

Foundry is in active development (v0.1.x). The core pipeline works end-to-end but APIs and data models may change. See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

Copyright 2026 Quintin Donnell Henry

Licensed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0). See [LICENSE](LICENSE) for the full text.

## Authorship

Foundry was designed, developed, and is maintained by Quintin Donnell Henry. The platform, its architecture, and its underlying concepts pre-date and are independent of any employment relationship. All intellectual property contained herein is the sole property of the author, licensed to the public under the terms of the Apache License 2.0.

## Contact

For questions, feedback, or collaboration inquiries: qdhenry@gmail.com
