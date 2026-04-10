# apps/desktop/ — Tauri 2 Desktop App

Cross-platform desktop app (macOS/Windows/Linux) built with Tauri 2, React 19, and Vite. Reuses 100% of `@foundry/ui` route components via Next.js API shims.

## Architecture

```
Browser (Vite dev :5175 / Tauri webview prod)
  -> React 19 + custom hash router
  -> @foundry/ui components (shared with apps/web)
  -> Convex (reactive data via WebSocket)
  -> Tauri IPC -> Rust backend (process mgmt, sandbox, worktrees)
```

## Routing

Custom hash-based routing (no server required). URL format: `tauri://localhost/#/programs/slug/tasks`

```typescript
// App.tsx resolves pathname -> RouteId -> RenderFn
type RouteId = "signIn" | "programs" | "taskDetail" | "sandboxSettings" | ...
```

- Auth routes (`/sign-in`, `/sign-up`) hide sidebar
- Program routes (`/:programId/:section/:detail?`) show sidebar + DashboardShellLayout
- Sandbox routes (`/sandboxes`, `/sandboxes/settings`) hide sidebar

## Shims (Critical Pattern)

Vite aliases intercept Next.js imports and replace with desktop implementations:

| Import | Shim | Purpose |
|--------|------|---------|
| `next/link` | `src/shims/next-link.tsx` | Hash navigation instead of Next.js router |
| `next/navigation` | `src/shims/next-navigation.ts` | `useRouter`, `usePathname`, `useParams` via hash |
| `next/dynamic` | `src/shims/next-dynamic.tsx` | `React.lazy` + `Suspense` wrapper |
| `@clerk/nextjs` | `src/shims/clerk-nextjs.tsx` | Clerk auth context shim |

Configured in `vite.config.ts` resolve.alias. This enables `@foundry/ui` to work without modification.

## Auth Flow

**Dev:** Clerk UI in Vite modal at `http://127.0.0.1:5175`
**Prod:** External browser -> Clerk sign-in -> deep link callback `foundrydesktop://auth/callback?__clerk_ticket=...` -> Tauri captures -> session created

## Tauri IPC Bridge

`src/lib/tauri-bridge.ts` defines typed command map to Rust:

```typescript
get_terminal_connection_info | list_files | read_file | write_file
send_chat_message | cancel_session | restart_session
configure_convex_sync | launch_local_session | pick_directory
```

## Rust Backend (src-tauri/)

| Module | Purpose |
|--------|---------|
| auth/ | Clerk token integration, keychain persistence |
| cache/ | SQLite local persistence |
| execution/ | Claude CLI/SDK subprocess execution |
| streaming/ | WebSocket server for terminal log streaming |
| worktree/ | Git worktree + branch management |
| sync/ | Convex device sync |
| process/ | Child process lifecycle management |

## Key Files

- `App.tsx` — Route resolution, sidebar/auth logic
- `main.tsx` — Provider bootstrap (Clerk, Convex, Theme)
- `shared-shell.tsx` — Re-exports all @foundry/ui route components
- `lib/tauri-bridge.ts` — IPC contract to Rust
- `lib/local-backend.ts` — ISandboxBackend implementation
- `src-tauri/tauri.conf.json` — App config, window size, plugins

## Rules

- Components must NOT depend on Next.js server features (no SSR, no server actions)
- All @foundry/ui imports resolved via Vite aliases, not direct file reads
- Desktop-specific UI only in `src/components/` (error boundaries, overlays)
- Use `ISandboxBackend` interface for sandbox operations (testable via DI)

## Cmd

Dev: `bun run dev` (Vite :5175 + Tauri dev server)
Build: `bun run build:desktop` (Tauri production binary)
Test: `bun test` (Vitest)
