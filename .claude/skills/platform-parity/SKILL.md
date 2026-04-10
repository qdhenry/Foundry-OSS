---
name: platform-parity
description: Audit and enforce feature parity between web (apps/web) and desktop (apps/desktop) platforms. Use when adding features, reviewing code placement, checking for drift between platforms, or validating that shared packages are used correctly. Triggers on mentions of "parity", "drift", "platform sync", "shared component", or "web vs desktop".
---

# Platform Parity Auditor

Enforce feature parity and correct layer placement across Foundry's multi-platform monorepo. Prevents drift between `apps/web/` (Next.js) and `apps/desktop/` (Tauri/Vite/React), and ensures shared packages (`packages/ui/`, `packages/types/`) are used correctly.

**Target structure** (from `docs/plans/bun_workspace_tauri_implementation_plan.md`):

```
Foundry-App/
  convex/                       # Stays at root
  packages/
    types/                      # @foundry/types — shared type definitions
    ui/                         # @foundry/ui — shared sandbox HUD components
      src/sandbox/backend.ts    # ISandboxBackend interface
  apps/
    web/                        # Next.js 15 + App Router
    desktop/                    # Tauri 2 + Vite + React 19
  sandbox-worker/
  agent-service/
```

## Audit Modes

When invoked, ask the user which mode to run (or run all if they say "full audit"):

### 1. Drift Audit

Scan both platforms for parallel implementations that should be shared.

**Run these searches:**

```
Glob: apps/web/src/components/**/*.tsx
Glob: apps/desktop/src/components/**/*.tsx
```

Compare filenames across both trees. Flag:
- **Identical names** — same component name in both `apps/web/` and `apps/desktop/` (strong candidate for extraction to `packages/ui/`)
- **Similar purpose** — components with different names but overlapping functionality (e.g., `WebLogViewer` vs `DesktopLogStream`)
- **Duplicated hooks** — custom hooks that exist in both apps

Also check for type duplication:

```
Grep: "export (type|interface|enum)" in apps/web/src/**/*.ts
Grep: "export (type|interface|enum)" in apps/desktop/src/**/*.ts
```

Flag any type definitions that exist in both apps but not in `packages/types/`.

**Output:** Table of duplicated components/types with recommendation (extract to shared, keep platform-specific, or merge).

### 2. Layer Placement Check

When reviewing new or modified code, verify it lives in the correct layer.

**Rules:**

| Code Type | Correct Location | Detection Pattern |
|-----------|-----------------|-------------------|
| Pure React components (no framework imports) | `packages/ui/` | No imports from `next/*`, `@clerk/nextjs`, `@tauri-apps/*`, `react-router-dom` |
| Types, validators, constants | `packages/types/` | `export type`, `export interface`, `export enum`, `export const` with no runtime deps |
| Next.js-coupled code | `apps/web/` only | Imports `useRouter` from `next/navigation`, `next/link`, `next/dynamic`, `@clerk/nextjs`, `next/image` |
| Tauri-coupled code | `apps/desktop/` only | Imports `invoke` from `@tauri-apps/api`, `@tauri-apps/*` |
| Convex queries/mutations | Can live in shared or either app | Imports from `convex/react` or generated `_generated/api` |

**Run these checks:**

```
# Next.js imports in shared packages (VIOLATION)
Grep: "from ['\"]next/" in packages/**/*.{ts,tsx}
Grep: "from ['\"]@clerk/nextjs" in packages/**/*.{ts,tsx}

# Tauri imports in shared packages (VIOLATION)
Grep: "from ['\"]@tauri-apps" in packages/**/*.{ts,tsx}

# Next.js imports in desktop app (VIOLATION)
Grep: "from ['\"]next/" in apps/desktop/**/*.{ts,tsx}
Grep: "from ['\"]@clerk/nextjs" in apps/desktop/**/*.{ts,tsx}

# Tauri imports in web app (VIOLATION)
Grep: "from ['\"]@tauri-apps" in apps/web/**/*.{ts,tsx}

# Pure React in app-specific dirs (candidate for extraction)
# Look for components with no framework imports
```

**Output:** List of violations with file path, import statement, and recommended fix.

### 3. Abstraction Seam Validation

The three critical interfaces must not be bypassed:

#### ISandboxBackend

Shared sandbox components in `packages/ui/` must use the `ISandboxBackend` interface, never call Convex actions or Tauri commands directly.

```
# Direct Convex sandbox calls in shared UI (VIOLATION)
Grep: "useMutation.*sandbox" in packages/ui/**/*.{ts,tsx}
Grep: "useAction.*sandbox" in packages/ui/**/*.{ts,tsx}
Grep: "(api as any)\.sandbox" in packages/ui/**/*.{ts,tsx}

# Direct Tauri invoke in shared UI (VIOLATION)
Grep: "invoke\(" in packages/ui/**/*.{ts,tsx}
```

#### Auth Adapter

Shared components must not import auth providers directly.

```
# Direct Clerk imports in shared packages (VIOLATION)
Grep: "from ['\"]@clerk/nextjs" in packages/**/*.{ts,tsx}
Grep: "from ['\"]@clerk/clerk-react" in packages/**/*.{ts,tsx}
Grep: "useOrganization|useUser|useAuth" in packages/ui/**/*.{ts,tsx}
```

Shared components should receive auth context via props or a framework-agnostic adapter.

#### Router Adapter

Shared components must not import routing libraries directly.

```
# Direct router imports in shared packages (VIOLATION)
Grep: "from ['\"]next/navigation" in packages/**/*.{ts,tsx}
Grep: "from ['\"]next/link" in packages/**/*.{ts,tsx}
Grep: "from ['\"]react-router-dom" in packages/**/*.{ts,tsx}
```

Shared components should use a `NavigationAdapter` or receive navigation callbacks as props.

**Output:** Pass/fail for each seam with specific violations listed.

### 4. Parallel Implementation Detection

Deep scan for code duplication across platforms.

```
# Components with identical names
Glob: apps/web/src/components/**/*.tsx → extract basenames
Glob: apps/desktop/src/components/**/*.tsx → extract basenames
# Intersect the two lists

# Similar function signatures
Grep: "export (default )?(function|const) \w+" in apps/web/src/**/*.{ts,tsx}
Grep: "export (default )?(function|const) \w+" in apps/desktop/src/**/*.{ts,tsx}
# Compare exported function names

# Duplicate type definitions
Grep: "export (type|interface) \w+" in apps/web/src/**/*.ts
Grep: "export (type|interface) \w+" in apps/desktop/src/**/*.ts
# Flag any that aren't in @foundry/types
```

**Known framework-agnostic components** (from current codebase analysis — strong extraction candidates):
- `SandboxLogStream` — pure log rendering
- `ChatPanel` — chat UI (needs `ISandboxBackend` for message sending)
- `SandboxTerminal` — terminal emulator (needs WebSocket URL from backend)
- `SandboxStatusBadge` — status display
- `RuntimeModeBadge` — runtime mode display
- `StageProgress` — setup stage progress bar
- `SandboxFileChanges` — file diff viewer

**Known platform-coupled components** (must stay in their respective apps):
- `SandboxHUD` — uses `useRouter` from `next/navigation`
- `SandboxEditor` — uses `next/dynamic`
- `SandboxManagerPage` — uses `next/link`, `@clerk/nextjs`
- `SandboxSettingsPage` — uses `next/link`, `@clerk/nextjs`

**Output:** List of parallel implementations with extraction recommendation.

### 5. Schema Compatibility Check

Verify `convex/schema.ts` supports both runtimes where needed.

```
# Check for runtime field on session tables
Grep: "runtime" in convex/schema.ts

# Expected fields on sandboxSessions:
# runtime: v.optional(v.union(v.literal("cloud"), v.literal("local")))
# localDeviceId: v.optional(v.string())
# localDeviceName: v.optional(v.string())

# Check for runtime-aware indexes
Grep: "by_runtime" in convex/schema.ts

# Check that new Convex functions exist for local execution
Grep: "startLocal|reportLocalCompletion|appendBatchFromDesktop" in convex/sandbox/**/*.ts
```

**Output:** Schema readiness checklist with pass/fail per requirement.

## Full Audit

When the user requests a "full audit" or "parity check", run all 5 modes sequentially and produce a summary report:

```
## Platform Parity Report

### Drift Audit
- X components duplicated across platforms
- Y types duplicated (should be in @foundry/types)

### Layer Placement
- X violations found
- [list each violation]

### Abstraction Seams
- ISandboxBackend: PASS/FAIL
- Auth Adapter: PASS/FAIL
- Router Adapter: PASS/FAIL

### Parallel Implementations
- X identical components found
- Y similar function signatures

### Schema Compatibility
- Runtime field: PRESENT/MISSING
- Runtime index: PRESENT/MISSING
- Local execution functions: X/3 found
```

## When to Trigger

Run this skill proactively when:
- Adding a new component or feature that could apply to both platforms
- Moving files between `apps/` and `packages/`
- Reviewing PRs that touch `packages/ui/` or `packages/types/`
- After a batch of changes to either platform
- Before a release to verify no drift has accumulated
- When someone asks about "parity", "drift", "platform sync", or "web vs desktop"
