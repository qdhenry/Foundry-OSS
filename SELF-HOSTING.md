# Self-Hosting Foundry

This guide walks you through deploying Foundry on your own infrastructure. By the end, you'll have a working instance with the core platform features: programs, requirements, discovery, task decomposition, and a single sandbox session.

## Prerequisites

- **Bun** 1.1+ (package manager and runtime)
- **Node.js** 20+ (required by some tooling)
- **Git** 2.x
- A **Convex** account (free tier at [convex.dev](https://convex.dev))
- An **Anthropic** API key (for AI features, at [console.anthropic.com](https://console.anthropic.com))
- A **Clerk** account (for authentication, free tier at [clerk.com](https://clerk.com)) — or use the simple auth provider for single-tenant deployments
- **Docker** (for sandbox execution)

Optional (enterprise features):
- Cloudflare account (for production sandbox worker and agent worker)
- GitHub App (for source control integration)
- Stripe account (for billing)
- Atlassian developer account (for Jira/Confluence)

## Step 1: Clone and install

```bash
git clone https://github.com/foundry-platform/foundry.git
cd foundry
bun install
```

## Step 2: Set up Convex

Convex is Foundry's backend — database, server functions, and real-time subscriptions all run here.

1. Create a free Convex project at [dashboard.convex.dev](https://dashboard.convex.dev)
2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in your Convex values in `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
```

4. Deploy the schema and functions:

```bash
bunx convex dev
```

This starts the Convex dev server, deploys your schema, and enables hot-reloading for backend changes. Keep this terminal running.

## Step 3: Set up authentication

### Option A: Clerk (recommended for multi-user deployments)

1. Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Enable Organizations in Clerk settings (this powers multi-tenancy)
3. Add your Clerk keys to `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev
```

4. Set `CLERK_JWT_ISSUER_DOMAIN` in the Convex dashboard environment variables (Settings → Environment Variables). This is how Convex validates JWTs from Clerk.

5. Set up the Clerk webhook for user sync:
   - In the Clerk dashboard, go to Webhooks
   - Create a webhook pointing to `{NEXT_PUBLIC_CONVEX_SITE_URL}/clerk-webhook`
   - Select the `user.created`, `user.updated`, and `organizationMembership.*` events
   - Copy the webhook signing secret to both `.env.local` and the Convex dashboard:

```bash
CLERK_WEBHOOK_SECRET=whsec_...
```

### Option B: Simple auth (single-tenant, no external provider)

For local development or single-user self-hosted deployments, you can use the built-in simple auth provider. This avoids the Clerk dependency entirely.

Set in `.env.local`:

```bash
FOUNDRY_AUTH_PROVIDER=simple
FOUNDRY_ADMIN_EMAIL=you@example.com
FOUNDRY_ADMIN_PASSWORD=your-secure-password
```

Simple auth creates a single organization ("default") and a single admin user. It does not support SSO, team management, or organization switching.

## Step 4: Set up AI

Foundry uses Claude for all AI features. You need an Anthropic API key.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Set it in the Convex dashboard environment variables:

```
ANTHROPIC_API_KEY=sk-ant-...
```

3. For local development, also start the agent service:

```bash
bun run dev:agent
```

This runs an Express server on port 3001 that proxies AI requests. Set in `.env.local`:

```bash
AGENT_SERVICE_URL=http://localhost:3001
```

### Using a different AI provider

The AI provider abstraction supports swapping Claude for other models. Set the provider in your Convex environment:

```
AI_PROVIDER=openai          # or "ollama", "anthropic" (default)
OPENAI_API_KEY=sk-...       # if using OpenAI
OLLAMA_BASE_URL=http://...  # if using Ollama
```

Note: Claude is the best-tested provider. Other providers may have reduced accuracy for complex delivery tasks due to differences in how they handle structured XML prompts.

## Step 5: Set up sandbox execution

The sandbox system runs AI coding agents in isolated Docker containers.

### Option A: Docker Compose (simplest, recommended for self-hosting)

```bash
# From the repo root:
docker compose -f sandbox-worker/docker-compose.yml up
```

This starts a single sandbox container locally. Set in `.env.local`:

```bash
SANDBOX_WORKER_URL=http://127.0.0.1:8788
SANDBOX_API_SECRET=$(openssl rand -hex 32)
```

Copy the same `SANDBOX_API_SECRET` value to the Convex dashboard environment variables.

### Option B: Cloudflare Workers (production-grade)

For production deployments or when you need multiple concurrent sandboxes:

1. Create a Cloudflare account
2. Configure the sandbox worker:

```bash
cd sandbox-worker
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your SANDBOX_API_SECRET
```

3. Deploy:

```bash
npx wrangler deploy
```

4. Set the worker URL in your Convex dashboard:

```
SANDBOX_WORKER_URL=https://migration-sandbox-worker.your-account.workers.dev
```

## Step 6: Start the frontend

```bash
bun run dev
```

Open `http://localhost:3000`. You should see the Foundry login screen.

## Step 7: Set up source control (optional)

To enable GitHub integration (repo connections, PR creation, webhook events):

1. Create a GitHub App at github.com/settings/apps
2. Required permissions: Contents (read/write), Pull Requests (read/write), Webhooks
3. Generate a private key and download it
4. Set in `.env.local`:

```bash
NEXT_PUBLIC_GITHUB_APP_SLUG=your-app-slug
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abc123
GITHUB_APP_CLIENT_SECRET=secret123
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

5. Set `GITHUB_WEBHOOK_SECRET` in the Convex dashboard as well.
6. Point your GitHub App's webhook URL to: `{NEXT_PUBLIC_CONVEX_SITE_URL}/github-webhook`

## Production deployment

### Frontend (Vercel)

```bash
# From apps/web:
vercel deploy --prod
```

Or connect your repo to Vercel for automatic deploys on push to main. Set all `NEXT_PUBLIC_*` environment variables in the Vercel dashboard.

### Frontend (other hosts)

Foundry's frontend is a standard Next.js app. It can be deployed to any host that supports Node.js 20+:

```bash
bun run build
bun run start
```

### Backend (Convex Cloud)

```bash
bunx convex deploy
```

Set all environment variables in the Convex dashboard (Settings → Environment Variables). Production requires: `ANTHROPIC_API_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`, `SANDBOX_WORKER_URL`, `SANDBOX_API_SECRET`, `AGENT_SERVICE_URL`, `AGENT_SERVICE_SECRET`.

### Agent worker (Cloudflare)

```bash
cd agent-worker
cp .dev.vars.example .dev.vars
# Set ANTHROPIC_API_KEY and AGENT_SERVICE_SECRET
npx wrangler deploy
```

Update `AGENT_SERVICE_URL` in the Convex dashboard to point to the deployed worker URL.

## Environment variable reference

### Required (core platform)

| Variable | Where to set | Purpose |
|----------|-------------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` + Vercel | Convex deployment URL |
| `CONVEX_DEPLOYMENT` | `.env.local` | Convex deployment identifier |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` + Vercel | Clerk frontend auth |
| `CLERK_SECRET_KEY` | `.env.local` + Vercel | Clerk backend auth |
| `CLERK_JWT_ISSUER_DOMAIN` | `.env.local` + Convex dashboard | JWT validation |
| `ANTHROPIC_API_KEY` | Convex dashboard + agent worker | AI inference |
| `SANDBOX_WORKER_URL` | Convex dashboard | Sandbox container management |
| `SANDBOX_API_SECRET` | `.env.local` + Convex dashboard + sandbox worker | Shared auth secret |
| `AGENT_SERVICE_URL` | Convex dashboard | AI inference routing |

### Optional (integrations)

| Variable | Purpose |
|----------|---------|
| `GITHUB_APP_*` | GitHub App integration |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook HMAC validation |
| `ATLASSIAN_*` | Jira/Confluence integration |
| `DEEPGRAM_API_KEY` | Audio transcription |
| `TWELVELABS_API_KEY` | Video analysis |
| `STRIPE_*` | Billing (enterprise) |

### Production-only

| Variable | Purpose |
|----------|---------|
| `AGENT_SERVICE_SECRET` | Bearer auth between Convex and agent worker |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook HMAC validation |

## Troubleshooting

**"Not authenticated" errors**: Check that `CLERK_JWT_ISSUER_DOMAIN` is set in both `.env.local` and the Convex dashboard. The Convex auth config (`convex/auth.config.ts`) reads from the environment at deploy time.

**Sandbox won't start**: Verify Docker is running and the `SANDBOX_API_SECRET` matches between your `.env.local` and the sandbox worker's `.dev.vars`. Check the sandbox worker logs for container provisioning errors.

**AI features not working**: Confirm `ANTHROPIC_API_KEY` is set in the Convex dashboard (not just `.env.local` — Convex actions read from dashboard environment variables, not the local env file).

**Real-time updates not appearing**: This usually means the Convex dev server isn't running. Check that `bun run dev:convex` is active in a terminal.

**"Access denied" on everything**: Your user might not have an organization membership. In Clerk, ensure the user is a member of at least one organization. For simple auth, check that `FOUNDRY_ADMIN_EMAIL` matches your login.
