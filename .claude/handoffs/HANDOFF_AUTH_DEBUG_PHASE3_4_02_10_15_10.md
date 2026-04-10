# Handoff: Clerk-Convex Auth Integration Fix + Phase 3/4 Implementation Complete

**Created:** 2026-02-10 ~3:10 PM
**Branch:** main
**Working Tree:** Clean (all committed)

---

## Summary

Completed Phases 3 (Knowledge Layer) and 4 (AI Integration & Mission Control) from the project roadmap using a parallel agent team. Then debugged and fixed the Clerk-Convex authentication pipeline which had three cascading issues: missing JWT template, wrong environment variable, and missing user record. The app now loads successfully at `/programs` with the empty state.

---

## Work Completed

### Phase 3 & 4 Implementation (Previous Session, Committed)

- [x] Skills backend (`convex/skills.ts`) — 9 functions: CRUD, versioning, template forking, requirement linking
- [x] Skills frontend — list/create/detail pages with editor, version history, diff viewer, template modal
- [x] Sprint Gates backend (`convex/sprintGates.ts`) — 11 functions: CRUD, criteria evaluation, approvals, finalize/override
- [x] Sprint Gates frontend — list/create/detail pages with criteria checklist, approval panel
- [x] AI backend (`convex/ai.ts`) — Claude API integration via Convex action with context assembly pipeline
- [x] AI frontend — activity feed, execution output with review actions, execute skill modal
- [x] Mission Control dashboard — KPI cards, workstream grid, requirement status bars, AI activity feed
- [x] Onboarding CTAs on program overview page

### Auth Debugging (This Session)

- [x] Created "convex" JWT template in Clerk dashboard (Sessions > JWT Templates > Convex preset)
- [x] Fixed `CLERK_JWT_ISSUER_DOMAIN` Convex env var (was `sunny-eft-32`, corrected to `exciting-barnacle-12`)
- [x] Manually synced user record via `npx convex run users:upsertFromClerk`
- [x] Added `useConvexAuth()` guard to `programs/page.tsx` and `programContext.tsx` to prevent race condition

### Key Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Added `useConvexAuth` skip guard | Prevents queries from firing before Convex JWT is validated — standard Clerk+Convex pattern | Could have added auth check in dashboard layout, but per-query is more granular |
| Used Convex preset JWT template | Auto-configures name, claims, and token lifetime correctly | Could have manually configured blank template |
| Manually synced user vs fixing webhook | Fastest path to unblock dev; webhook requires Convex site URL to be exposed | Could have set up ngrok/tunnel for webhook |

---

## Files Affected

### Modified (This Session)

- `src/app/(dashboard)/programs/page.tsx` — Added `useConvexAuth` import and `isAuthenticated` check on query skip
- `src/lib/programContext.tsx` — Added `useConvexAuth` import and `isAuthenticated` check on `programs.get` query

### Created (Previous Session, in Commit `52f1383`)

**Backend:**
- `convex/skills.ts` — Skills CRUD with domain filtering, versioning, template forking
- `convex/skillVersions.ts` — Version listing, get, compare for diff
- `convex/skillTemplates.ts` — 8 hardcoded AcmeCorp skill templates
- `convex/sprintGates.ts` — Gates CRUD with criteria evaluation, approvals, finalize/override
- `convex/agentExecutions.ts` — Execution listing, get, review status updates
- `convex/ai.ts` — `getContextData` (internalQuery), `logExecution` (internalMutation), `executeSkill` (action)
- `convex/model/context.ts` — `assemblePrompt()` with XML-tagged sections

**Frontend Pages:**
- `src/app/(dashboard)/[programId]/skills/page.tsx` — Skills list with domain filters
- `src/app/(dashboard)/[programId]/skills/new/page.tsx` — Create skill form
- `src/app/(dashboard)/[programId]/skills/[skillId]/page.tsx` — Skill detail/editor with tabs
- `src/app/(dashboard)/[programId]/gates/page.tsx` — Gates list grouped by workstream
- `src/app/(dashboard)/[programId]/gates/new/page.tsx` — Create gate with dynamic criteria
- `src/app/(dashboard)/[programId]/gates/[gateId]/page.tsx` — Gate evaluation page
- `src/app/(dashboard)/[programId]/activity/page.tsx` — Agent activity log

**Frontend Components:**
- `src/components/skills/` — SkillEditor, VersionHistory, VersionDiff, SkillTemplateModal
- `src/components/gates/` — GateCard, CriteriaChecklist, ApprovalPanel
- `src/components/dashboard/` — KpiCards, WorkstreamGrid, RequirementStatusBars, AiActivityFeed
- `src/components/ai/` — ActivityFeed, ExecutionOutput, ExecuteSkillModal

### Key Reference Files

- `convex/schema.ts` — 11 tables, all indexes (NOT modified, pre-existing)
- `convex/model/access.ts` — `assertOrgAccess()` and `getAuthUser()` (NOT modified)
- `convex/http.ts` — Clerk webhook handler for user sync
- `convex/users.ts` — `upsertFromClerk` internal mutation
- `convex/auth.config.ts` — Uses `process.env.CLERK_JWT_ISSUER_DOMAIN`
- `src/lib/convex.tsx` — ClerkProvider > ConvexProviderWithClerk wrapping

---

## Technical Context

### Auth Flow (Now Working)

```
Clerk (client) → JWT with aud:"convex" → ConvexProviderWithClerk → Convex WebSocket
Convex server → validates JWT via CLERK_JWT_ISSUER_DOMAIN JWKS → ctx.auth.getUserIdentity()
assertOrgAccess() → looks up user by clerkId → checks orgIds includes requested orgId
```

### Environment Variables

| Variable | Location | Value |
|----------|----------|-------|
| `CLERK_JWT_ISSUER_DOMAIN` | Convex env | `https://exciting-barnacle-12.clerk.accounts.dev` |
| `CLERK_JWT_ISSUER_DOMAIN` | `.env.local` | `https://exciting-barnacle-12.clerk.accounts.dev` |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | `https://reminiscent-impala-166.convex.cloud` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` | `pk_test_ZXhjaXRpbm...` |

### Convex User Record Created

```
clerkId: "user_39UZSeqwz7R5Ka1czAtJZvPpFjL"
email: "qhenry@pm.me"
name: "Quintin Henry"
orgIds: ["org_39Ub8AHpR0BRtQYkQTkh1cIA2bB"]
```

---

## Things to Know

### Gotchas & Pitfalls

- **Clerk webhook not configured for dev** — User sync relies on Clerk webhook hitting `{CONVEX_SITE_URL}/clerk-users-webhook`. For local dev, this requires a tunnel (ngrok) or manual user creation via `npx convex run users:upsertFromClerk`. Any new users or org membership changes won't auto-sync without the webhook.
- **`/dashboard` is not a valid route** — It gets captured by `[programId]` dynamic segment. Users must go to `/programs` first, then click into a specific program.
- **Convex actions can't access DB directly** — `ai.ts` uses `ctx.runQuery(internal.ai.getContextData)` and `ctx.runMutation(internal.ai.logExecution)` pattern.
- **`useConvexAuth` race condition** — Every page using `useQuery` with auth-protected Convex functions should check `isAuthenticated` before firing. Currently only `programs/page.tsx` and `programContext.tsx` have this guard. Other pages inside `[programId]` layout are protected by `ProgramProvider` which now has the guard.

### Known Pre-Existing TypeScript Errors

These were noted during Phase 3/4 implementation but NOT fixed:
- `WorkstreamGrid` component has a type mismatch
- `CreateRequirementForm` has args issues
- `RequirementDetailPanel` has undefined reference

Run `npx tsc --noEmit` to see the full list.

### Running Processes

- `npx convex dev` running in background (task ID: `b676019`)
- Next.js dev server likely running on `localhost:3000`

---

## Current State

### What's Working

- Auth pipeline: Clerk sign-in → JWT → Convex validation → user lookup
- Programs page: loads with empty state, "Create Program" button visible
- Sidebar navigation: all sections render (Main, Discovery, Knowledge, Activity)
- Full app shell: header with search, theme toggle, user avatar, org switcher

### What's Not Working / Not Tested

- **Creating a program** — not tested yet; "Create Program" button should navigate to `/programs/new`
- **Seed data** — AcmeCorp seed data (`convex/seed.ts`) has not been run
- **Skills/Gates/Activity pages** — not tested with real data yet
- **AI execution** — requires `ANTHROPIC_API_KEY` in Convex env (not verified)
- **Clerk webhook** — not configured for dev; future users/org changes won't sync

---

## Next Steps

### Immediate (Start Here)

1. **Test program creation** — Click "Create Program" at `/programs`, fill in AcmeCorp details (Magento → Salesforce B2B), verify it creates with 7 auto-generated workstreams
2. **Run seed data** — Execute `npx convex run seed:seedAcmeCorp '{"orgId": "org_39Ub8AHpR0BRtQYkQTkh1cIA2bB"}'` to populate 118 requirements across 7 workstreams
3. **Test program dashboard** — Navigate into the created program to test Mission Control (KPIs, workstream grid, requirement bars)
4. **Fix pre-existing TS errors** — Run `npx tsc --noEmit` and fix the WorkstreamGrid, CreateRequirementForm, and RequirementDetailPanel issues

### Subsequent

- Test skills CRUD workflow: create skill → edit content → verify version history
- Test gates workflow: create gate → add criteria → evaluate → finalize
- Verify AI execution flow (needs `ANTHROPIC_API_KEY` in Convex dashboard env)
- Set up Clerk webhook for automatic user sync (configure endpoint in Clerk dashboard → Webhooks)
- Update `.planning/STATE.md` and `.planning/ROADMAP.md` to reflect Phase 3/4 completion
- Commit the auth fixes if not already committed

### Blocked On

- **AI execution** requires `ANTHROPIC_API_KEY` set in Convex environment variables
- **Webhook user sync** requires configuring Clerk webhook endpoint (URL: `https://reminiscent-impala-166.convex.site/clerk-users-webhook`)

---

## Commands to Run

```bash
# Dev servers (if not running)
npx convex dev                    # Convex backend hot-reload
npm run dev                       # Next.js frontend

# Seed data
npx convex run seed:seedAcmeCorp '{"orgId": "org_39Ub8AHpR0BRtQYkQTkh1cIA2bB"}'

# Type checking
npx tsc --noEmit                  # Find all TS errors

# Check Convex env vars
npx convex env list

# Manually sync a user (if needed)
npx convex run users:upsertFromClerk '{"clerkId": "...", "email": "...", "name": "...", "orgIds": ["org_..."]}'
```

### Search Queries

- `useConvexAuth` — finds all files with the auth race condition guard
- `assertOrgAccess` — finds all auth-protected Convex functions
- `useQuery.*skip` — finds all conditional query patterns
- `SKILL_TEMPLATES` — finds the 8 AcmeCorp skill templates

---

## Session Notes

- The Convex dev deployment is `reminiscent-impala-166` (dashboard: `https://dashboard.convex.dev/d/reminiscent-impala-166`)
- Clerk app is "B2B Migrator V1" in "Personal workspace" on Hobby plan
- The `convex/auth.config.ts` reads `CLERK_JWT_ISSUER_DOMAIN` from local env (`.env.local`) during `npx convex dev`, NOT from Convex dashboard env vars. The Convex dashboard env var is used for production deploys.

---

_This handoff was generated at context window capacity. Start a new session and use this document as your initial context._
