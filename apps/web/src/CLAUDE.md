# src/
Next.js 16 App Router + React 19 frontend. Ultra-thin page wrappers around @foundry/ui.

## Provider Order (critical)
ClerkProvider(Server) -> ConvexProviderWithClerk(Client) -> ThemeProvider -> SandboxBackendProvider -> SandboxHUDProvider -> SearchProvider -> DashboardShellLayout -> ProgramProvider(at [programId])

## Page Pattern
All 47 pages are `"use client"` thin wrappers (1-7 lines) around @foundry/ui route components:
```tsx
export default function Page() { return <ProgramTasksRoute />; }
```
No SSR, no data fetching at page level. All data via Convex hooks in UI components.

## Styling
Tailwind 4.1 CSS-first (no tailwind.config.js). Tokens via `@theme` in globals.css.
Fonts: Instrument Serif (display), DM Sans (body), DM Mono (code)
Use design tokens (`text-primary`, `surface-default`), never raw colors.
Utility classes: `.btn-primary`, `.card`, `.input`, `.badge`, `.type-display-xl`
No purple. Dark mode via `.dark` class + CSS custom properties.

## State
Convex: useQuery/useMutation/useAction (reactive). Skip with `"skip"` when auth unresolved.
Context: ThemeProvider, ProgramProvider, SandboxHUDProvider (useReducer), SearchProvider

## Next.js 16
- params & searchParams are Promises — must await
- headers()/cookies() are async
- Dynamic imports for SSR-sensitive components (`{ssr:false}`)

## Routes
`(dashboard)/[programId]/` — 32+ program-scoped pages (tasks, skills, gates, risks, discovery, sprints, workstreams, utilities, videos, etc.)
`(dashboard)/programs/` — Program list + new program
`(dashboard)/sandboxes/` — Sandbox manager + settings
Public: `/`, `/sign-in`, `/sign-up`, `/onboarding`, `/pricing`
Keyboard: Cmd+K search, Cmd+J toggle HUD

## API Routes (4)
- `/api/agent/summarize-discovery` — Proxy to agent service (Clerk auth)
- `/api/agent-auth/` — GET/POST/DELETE agent API key management
- `/api/github/callback/` — GitHub App OAuth callback -> redirect
- `/api/atlassian/callback/` — Atlassian OAuth callback -> redirect

All are thin proxies: auth check + forward to backend service.

## Testing
Vitest + @testing-library/react. Mock convex/react, programContext, next/navigation.
Storybook: @storybook/nextjs-vite, mocks in .storybook/mocks/

## Auth
middleware.ts: Clerk protects all except /, sign-in, sign-up, pricing, /api/webhooks
Org = tenant. Backend enforces orgId via assertOrgAccess().

## Deps
Minimal: `@foundry/types` + `@foundry/ui` (workspace). All heavy deps at monorepo root.
