# packages/ui/ — @foundry/ui

Shared component library (267 files). ALL feature UI lives here — both `apps/web` and `apps/desktop` import from this package.

## Structure

Each domain has its own directory with an `index.ts` barrel export:

```
src/
  workstreams/    (30) # WorkstreamsPage, WorkstreamDetail, pipeline/ (stages, decomposition)
  tasks/          (22) # TaskBoard, TaskCard, TaskFilters, SubtaskPanel, source-control/, audit/
  sandbox/        (20) # SandboxHUD, ChatPanel, Terminal, Editor, ConfigPanel, FileChanges
  utilities/      (19) # Code analyzer, utility pages
  discovery/      (19) # DiscoveryPage, DocumentZone, FindingsPagination, MergeableFindingCard
  pipeline-lab/   (15) # Pipeline visualization, stage management
  billing/        (13) # UsageDashboard, BillingSettings, OverageWarnings
  dashboard-shell/(11) # DashboardShellLayout, Sidebar, Header, CommandPalette, NotificationBell
  skills/         (11) # SkillsPage, SkillDetail, SkillTemplates
  videos/         (11) # VideosPage, VideoDetail, VideoUpload
  playbooks/      (10) # PlaybookCard, PlaybookDetail
  integrations/   (10) # IntegrationCard, IntegrationDetail, FlowDiagram
  gates/           (9) # ApprovalPanel, CriteriaChecklist, GateCard, SprintGateEvaluator
  risks/           (8) # RiskCard, RisksPage
  mission-control/ (8) # ProgramMissionControlRoute
  overview/        (7) # Program overview/summary views
  sprints/         (7) # SprintsPage, SprintDetail
  activity/        (6) # ActivityFeed, ExecuteSkillModal
  audit/           (6) # AuditEntry, AuditFilters, AuditTimeline
  programs/        (4) # ProgramsPage, ProgramProvider, useProgramContext
  theme/           (4) # ThemeProvider, globals.css, animations, GSAP utilities
  patterns/        (4) # Pattern library/snippet cards
  brand/           (3) # FoundryLogo, FoundryMark
  settings/        (4) # Settings pages, configuration tabs
  pricing/         (2) # Pricing page components
```

## Conventions

- **Route components** named `Program{Domain}Route` (e.g., `ProgramTasksRoute`, `ProgramDiscoveryRoute`)
- **Path exports**: import via `@foundry/ui/tasks`, `@foundry/ui/sandbox`, etc. (25+ paths in package.json exports)
- **No build step**: used directly from source via bun workspaces
- **Convex hooks**: `useQuery`/`useMutation`/`useAction` with `"skip"` for unresolved auth
- **Styling**: Tailwind 4.1 utility classes, design tokens from `globals.css` `@theme`
- **No purple**: Use blue/slate palette for AI features

## Context Providers

- `SandboxHUDProvider` — Multi-tab HUD state (useReducer: OPEN_TAB, CLOSE_TAB, FOCUS_TAB, SET_SUB_TAB, TOGGLE_EXPANDED, OPEN_CONFIG)
- `ProgramProvider` — Program data + auth validation + stats (completion %, workstreams, risks)
- `ThemeProvider` — Light/dark theme + system preference detection
- `SandboxBackendProvider` — Injects ISandboxBackend implementation (testable via DI)
- `SearchProvider` — Command palette / search state

## Hooks

- `useSandboxHUD()`, `useSandboxBackend()`, `useProgramContext()`, `useTheme()`, `useSearch()`
- `useProgramSlug()`, `useProgramSettingsPath()` — Billing-specific path utilities
- `useUploadQueue()` — Discovery document upload state
- `usePipelineKeyboard()` — Pipeline keyboard shortcuts
- Animation: `useStaggerEntrance()`, `useCountUp()`, `useProgressBar()`, `useSlideReveal()`, `useTabIndicator()`, `useFadeIn()`

## Sandbox HUD

The flagship UI surface. Bottom bar with 6 tabs: Logs | Terminal | File Changes | Editor | Audit | Chat.

- Collapsed (36px) / expanded (400px, user-resizable, stored in localStorage)
- Terminal: xterm.js + WebSocket (HMAC token auth)
- Config panel: slides in on task-detail routes
- Dynamically imported with `{ssr: false}`
- Keyboard: Cmd+J (Mac) / Ctrl+J (Win) to toggle

## Design Token Layers

1. **Primitive tokens**: `--brand-blue-50` to `--brand-blue-900`, spacing, radius, opacity
2. **Semantic tokens**: `--surface-page/default/raised/elevated/overlay`, `--text-primary/secondary/muted`, `--interactive-ghost/subtle/hover/active`
3. **Status tokens**: `--status-success-{fg,bg,border}`, warning, error, info
4. **Component tokens**: `--component-button-*`, `--component-card-*`, `--component-terminal-*`
5. **Dark mode**: `.dark` class on `<html>`, tokens auto-switch via CSS variables

## Desktop Compatibility

Desktop app imports from here but uses shims for Next.js APIs (`next/link`, `next/navigation`, `next/dynamic`, `@clerk/nextjs`). Components must not depend on Next.js server features.

## Deps

Direct: react-markdown, sonner. Peer (from apps): react 19, convex/react, @clerk/nextjs, next, tailwindcss 4.1, gsap.
