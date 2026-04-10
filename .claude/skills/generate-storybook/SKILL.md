---
name: generate-storybook
description: Initializes Storybook for the Foundry codebase, discovers all components and pages, then deploys parallel subagents to generate comprehensive stories with visual, interaction, accessibility, and responsive coverage. Use when setting up Storybook or generating stories for components.
---

<essential_principles>

**Stack context:** Foundry is a Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4.1 application. Components use Untitled UI primitives. Auth is Clerk. Backend is Convex (reactive BaaS). All data hooks (`useQuery`, `useMutation`) require mock decorators in stories.

**Component domains (25):** ai, ai-features, audit, comments, coordination, dashboard, discovery, documents, gates, integrations, layout, mission-control, pipeline, pipeline-lab, playbooks, programs, risks, sandbox, search, shared, skills, source-control, sprints, tasks, videos

**Pages (42+):** All under `src/app/(dashboard)/[programId]/` plus auth pages at `src/app/sign-in/`, `src/app/sign-up/`.

**Story standards — every story file MUST include:**
- Default visual story per component variant
- Play functions for interactive elements (click, type, select, hover)
- Accessibility assertions via `@storybook/test` (`expect` + `within`)
- Responsive viewport stories (mobile 375px, tablet 768px, desktop 1280px)
- Mock decorators for Convex queries/mutations and Clerk auth context

**Subagent parallelization:** Component domains are independent. Deploy one subagent per domain directory (up to 6 concurrent). Each subagent discovers `.tsx` files (excluding `.test.tsx`, `.stories.tsx`), reads each component, and generates a `.stories.tsx` file beside it.

**File naming:** `ComponentName.stories.tsx` placed adjacent to `ComponentName.tsx`.

**Never generate stories for:** test files, type-only files, barrel exports (index.ts), layout wrappers that only compose providers.
</essential_principles>

<intake>
What would you like to do?

1. **Initialize Storybook** — Install and configure Storybook for Foundry from scratch
2. **Generate all stories** — Deploy subagents to create stories for every component and page
3. **Full setup** — Initialize Storybook AND generate all stories in one run
4. **Add a story** — Generate a story for a single new component

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|----------|----------|
| 1, "init", "initialize", "install", "setup storybook" | `workflows/initialize-storybook.md` |
| 2, "generate", "stories", "all stories", "create stories" | `workflows/generate-stories.md` |
| 3, "full", "both", "everything", "full setup" | `workflows/initialize-storybook.md` THEN `workflows/generate-stories.md` |
| 4, "add", "single", "one component", "new story" | `workflows/add-story.md` |

**After reading the workflow, follow it exactly.**
</routing>

<reference_index>
All domain knowledge in `references/`:

**Codebase map:** foundry-component-map.md — All 25 component domains with file listings and page routes
**Story patterns:** story-templates.md — CSF3 story templates with full coverage (visual, interaction, a11y, responsive)
**Storybook config:** storybook-config.md — Configuration patterns for Next.js 15 + Tailwind 4.1 + Convex + Clerk
</reference_index>

<workflows_index>
| Workflow | Purpose |
|----------|---------|
| initialize-storybook.md | Install deps, configure Storybook for Foundry's stack |
| generate-stories.md | Deploy parallel subagents to create stories for all components and pages |
| add-story.md | Generate a story for a single component |
</workflows_index>

<success_criteria>
- Storybook launches without errors via `bun run storybook`
- Every `.tsx` component in `src/components/` has a corresponding `.stories.tsx`
- Every page in `src/app/` has a corresponding `.stories.tsx`
- Stories render visually, pass interaction tests, include a11y checks, and test responsive viewports
- No stories generated for test files, types, or barrel exports
</success_criteria>
