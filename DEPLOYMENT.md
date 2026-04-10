# Foundry Production Deployment Guide

## Architecture Overview

```
Vercel (apps/web)
  ├── Edge Middleware (Clerk auth)
  ├── Static/SSR pages (React 19, Next.js 16)
  ├── 4 Serverless API routes (OAuth callbacks, agent-auth)
  └── Client WebSocket → Convex Cloud

Convex Cloud (already deployed)
  ├── 55 tables, server functions, AI actions
  └── HTTP calls → Cloudflare Workers

Cloudflare Workers
  ├── foundry-agent-worker — AI analysis routes (Hono + Anthropic SDK)
  └── migration-sandbox-worker — sandbox execution (Durable Objects + Containers)
```

---

## Prerequisites

- Cloudflare account with Workers Paid plan
- Vercel account (Pro recommended)
- Convex Cloud deployment (already provisioned)
- Clerk production instance
- GitHub App configured
- Atlassian OAuth app configured (optional)
- `wrangler` CLI authenticated: `wrangler login`
- `gh` CLI authenticated (for PR workflows)

---

## Step 1: Deploy Agent Worker (Cloudflare)

### 1a. Install dependencies

```bash
cd agent-worker
bun install
```

### 1b. Deploy the worker

```bash
wrangler deploy
```

Note the deployed URL (e.g., `https://foundry-agent-worker.<account>.workers.dev`).

### 1c. Set secrets

```bash
wrangler secret put ANTHROPIC_API_KEY
# Paste your Anthropic API key

wrangler secret put AGENT_SERVICE_SECRET
# Generate a strong random secret: openssl rand -hex 32

wrangler secret put ATLASSIAN_CLIENT_ID
# Paste Atlassian OAuth client ID (skip if not using Atlassian)

wrangler secret put ATLASSIAN_CLIENT_SECRET
# Paste Atlassian OAuth client secret

wrangler secret put ATLASSIAN_OAUTH_REDIRECT_URI
# e.g., https://your-domain.com/api/atlassian/callback
```

### 1d. Verify deployment

```bash
curl https://foundry-agent-worker.<account>.workers.dev/health
# Expected: {"ok":true,"data":{"status":"ok","service":"foundry-agent-worker",...}}

# Verify auth rejects unauthenticated requests:
curl https://foundry-agent-worker.<account>.workers.dev/auth/status
# Expected: 401 {"error":{"code":"UNAUTHORIZED","message":"Invalid or missing bearer token."}}

# Verify auth accepts valid token:
curl -H "Authorization: Bearer <your-secret>" \
  https://foundry-agent-worker.<account>.workers.dev/auth/status
# Expected: 200 {"isConfigured":true,"source":"environment",...}
```

---

## Step 2: Configure Convex (Production)

### 2a. Set environment variables in Convex Dashboard

Navigate to your Convex deployment dashboard and set:

| Variable | Value |
|----------|-------|
| `AGENT_SERVICE_URL` | `https://foundry-agent-worker.<account>.workers.dev` |
| `AGENT_SERVICE_SECRET` | Same secret used in Step 1c |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `SANDBOX_WORKER_URL` | `https://migration-sandbox-worker.<account>.workers.dev` |
| `SANDBOX_API_SECRET` | Shared secret for sandbox worker |
| `CLERK_WEBHOOK_SECRET` | From Clerk dashboard |
| `GITHUB_WEBHOOK_SECRET` | HMAC secret for GitHub webhooks |
| `ATLASSIAN_WEBHOOK_SECRET` | HMAC secret for Atlassian webhooks |

Or via CLI:

```bash
bunx convex env set AGENT_SERVICE_URL https://foundry-agent-worker.<account>.workers.dev
bunx convex env set AGENT_SERVICE_SECRET <same-secret-from-step-1c>
```

### 2b. Deploy Convex functions

```bash
bunx convex deploy
```

---

## Step 3: Deploy Frontend (Vercel)

### 3a. Connect repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `apps/web`
   - **Build Command:** `bun run build` (auto-detected)
   - **Install Command:** `bun install` (runs at monorepo root, resolves workspace deps)
   - **Node.js Version:** 20.x

### 3b. Set environment variables

**Public (available at build time + runtime):**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | Your Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production Clerk publishable key |
| `NEXT_PUBLIC_GITHUB_APP_SLUG` | `<your-github-app-slug>` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Production Convex site URL |

**Secret (server-side only):**

| Variable | Value |
|----------|-------|
| `CLERK_SECRET_KEY` | Production Clerk secret key |
| `CLERK_JWT_ISSUER_DOMAIN` | Production Clerk domain |
| `CLERK_WEBHOOK_SECRET` | Webhook signature verification |
| `GITHUB_APP_ID` | `<your-github-app-id>` |
| `GITHUB_APP_PRIVATE_KEY` | RSA private key (paste full PEM) |
| `GITHUB_APP_CLIENT_ID` | OAuth client ID |
| `GITHUB_APP_CLIENT_SECRET` | OAuth client secret |
| `ATLASSIAN_CLIENT_ID` | Atlassian OAuth client ID |
| `ATLASSIAN_CLIENT_SECRET` | Atlassian OAuth client secret |
| `ATLASSIAN_OAUTH_REDIRECT_URI` | `https://<your-domain>/api/atlassian/callback` |
| `AGENT_SERVICE_URL` | `https://foundry-agent-worker.<account>.workers.dev` |
| `SANDBOX_WORKER_URL` | `https://migration-sandbox-worker.<account>.workers.dev` |
| `SANDBOX_API_SECRET` | Shared sandbox secret |

**Not needed on Vercel** (these live in Convex Dashboard / Wrangler only):
`CONVEX_DEPLOYMENT`, `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `TWELVELABS_API_KEY`, `ELEVENLABS_API_KEY`, `AGENT_SERVICE_SECRET`

### 3c. Deploy

Vercel deploys automatically on push to `main`. For manual deploy:

```bash
cd apps/web && npx vercel --prod
```

### 3d. Custom domain (optional)

1. Go to Vercel project → Settings → Domains
2. Add your domain
3. Configure DNS:
   - **CNAME:** `cname.vercel-dns.com` (if using subdomain)
   - **A records:** Vercel IP addresses (if using apex domain)
4. SSL is auto-provisioned by Vercel

---

## Step 4: Configure OAuth Callbacks

Update callback URLs to point to your production domain:

### GitHub App

1. Go to GitHub → Settings → Developer settings → GitHub Apps → Your App
2. Update **Callback URL** to: `https://<your-domain>/api/github/callback`
3. Update **Webhook URL** to your Convex HTTP endpoint for GitHub events

### Atlassian App

1. Go to [developer.atlassian.com](https://developer.atlassian.com) → Your App
2. Update **Callback URL** to: `https://<your-domain>/api/atlassian/callback`

### Clerk

1. Go to Clerk Dashboard → Production instance
2. Verify domain settings match your Vercel domain
3. Configure webhook endpoint → Convex HTTP endpoint for Clerk events

---

## Step 5: Configure Webhooks

All webhooks point to Convex Cloud HTTP endpoints (not Vercel):

| Service | Webhook URL | Secret Variable |
|---------|------------|-----------------|
| Clerk | `https://<convex-site-url>/clerk-webhook` | `CLERK_WEBHOOK_SECRET` |
| GitHub | `https://<convex-site-url>/github-webhook` | `GITHUB_WEBHOOK_SECRET` |
| Atlassian | `https://<convex-site-url>/atlassian-webhook` | `ATLASSIAN_WEBHOOK_SECRET` |

---

## Verification Checklist

### Vercel

- [ ] Build succeeds on Vercel dashboard
- [ ] Landing page loads at production URL
- [ ] Clerk sign-in/sign-out works
- [ ] Organization switching works
- [ ] Convex data loads (real-time subscriptions active)
- [ ] GitHub OAuth callback works (`/api/github/callback`)
- [ ] Atlassian OAuth callback works (`/api/atlassian/callback`)

### Agent Worker

- [ ] `/health` returns 200
- [ ] Unauthenticated requests return 401
- [ ] Bearer auth accepts valid token
- [ ] `/auth/status` shows `isConfigured: true`
- [ ] `/atlassian/connection-health` returns env check results

### End-to-End

- [ ] Trigger AI analysis from production UI → agent worker processes → results appear in Convex
- [ ] Discovery analysis completes successfully
- [ ] Task decomposition (with thinking tokens) completes
- [ ] Risk evaluation completes
- [ ] Gate evaluation completes
- [ ] Sprint planning completes
- [ ] Sandbox execution works (already deployed worker)
- [ ] Webhook events process correctly (Clerk, GitHub, Atlassian)

### Local Dev Still Works

- [ ] `bun run dev` starts Next.js on port 3000
- [ ] `bun run dev:convex` starts Convex dev
- [ ] `bun run dev:agent` starts Express on port 3001 with Claude Code auth
- [ ] `bun run dev:worker` starts sandbox worker on port 8788
- [ ] AI routes work through Express locally (no bearer auth required)

---

## Cost Estimates

| Service | Plan | Monthly Estimate |
|---------|------|-----------------|
| Vercel | Pro | ~$20 (compute offloaded to Convex/CF) |
| Cloudflare Workers | Paid | ~$5 base (agent-worker is low-volume) |
| Convex Cloud | Existing | Already provisioned |
| **Total new cost** | | **~$25/mo base** |

Anthropic API costs are separate and usage-dependent.

---

## Rollback Procedures

### Vercel

Vercel maintains deployment history. To rollback:
1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

### Agent Worker

```bash
# List recent deployments
wrangler deployments list

# Rollback to a specific deployment
wrangler rollback <deployment-id>
```

### Convex

```bash
# Convex maintains function version history
# Redeploy from a known-good commit:
git checkout <good-commit>
bunx convex deploy
```

---

## Troubleshooting

### Agent Worker returns 500 on AI routes

1. Check that `ANTHROPIC_API_KEY` is set: `wrangler secret list`
2. Check Worker logs: `wrangler tail` (real-time log stream)
3. Verify the API key is valid by testing directly

### Convex can't reach Agent Worker

1. Verify `AGENT_SERVICE_URL` is set correctly in Convex Dashboard
2. Verify `AGENT_SERVICE_SECRET` matches between Convex and Wrangler
3. Check Convex function logs for HTTP errors

### Vercel build fails

1. Check that `apps/web` is set as Root Directory
2. Verify all `NEXT_PUBLIC_*` env vars are set (needed at build time)
3. Check that workspace dependencies resolve: `@foundry/ui`, `@foundry/types`
4. Ensure Node.js version is 20.x (for Bun compatibility)

### OAuth callbacks fail

1. Verify callback URLs match exactly (including trailing slashes)
2. Check that client ID/secret env vars are set on Vercel
3. Check Vercel function logs for the specific callback route

### Webhooks not processing

1. Verify webhook URLs point to Convex HTTP endpoints (not Vercel)
2. Check HMAC secrets match between service and Convex Dashboard
3. Check Convex function logs for webhook processing errors
4. Check retry queue tables for failed attempts
