---
name: create-ui-component
description: Creates UI components for the Foundry platform using the design system, UntitledUI icons, dark/light mode support, and Storybook stories. Use when building new UI components, adding stories, or when the user invokes /create-ui-component.
---

<objective>
Build design-system-compliant React components for the Foundry platform with automatic dark/light theme support and Storybook coverage. Covers new component creation, adding Untitled UI source-owned components, and adding stories to existing components.
</objective>

<quick_start>
Determine the user's intent using the intake section below, then route to the appropriate workflow file.
</quick_start>

<essential_principles>
These rules are non-negotiable for every component:

DESIGN TOKENS ONLY — Never use raw Tailwind colors. Always use semantic token classes:
- `text-text-primary` not `text-gray-900`
- `bg-surface-default` not `bg-white`
- `border-border-default` not `border-slate-200`

DARK/LIGHT MODE VIA CSS CUSTOM PROPERTIES — Components must NOT use the `dark:` Tailwind prefix. The token system handles theming automatically via CSS variables on `:root` and `.dark` class. A component styled with `bg-surface-default text-text-primary` works correctly in both themes without any dark-mode-specific code.

ICONS FROM @untitledui/icons — Import individual icons by name:
```tsx
import { Grid01, AlertTriangle, Activity } from "@untitledui/icons";
<Grid01 size={20} className="text-text-muted" />
```
Icon sizes: 16 (sm), 20 (default), 24 (lg)

"use client" DIRECTIVE — Add `"use client"` at the top of every interactive component (event handlers, hooks, state).

CO-LOCATE STORIES — Story files live next to their component: `ComponentName.stories.tsx` beside `ComponentName.tsx`.

NO PURPLE — Never use purple color schemes. Use the existing blue/slate palette.

USE UTILITY CLASSES WHERE APPLICABLE — Prefer globals.css utility classes when they exist:
- `.btn-primary`, `.btn-secondary`, `.btn-ghost` for buttons
- `.card`, `.card-interactive` for card containers
- `.input`, `.textarea`, `.select` for form inputs
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-error`, `.badge-info` for badges
- `.modal`, `.modal-overlay` for modals
- `.tooltip` for tooltips
- `.table-header`, `.table-cell`, `.table-row-hover` for tables
- `.type-display-xl` through `.type-code` for typography

FONTS:
- Display headings: `font-display` (Instrument Serif)
- Body text: `font-sans` (DM Sans) — this is the default
- Code/monospace: `font-mono` (DM Mono)

UNTITLED UI FRAMEWORK — Source-owned components from Untitled UI React can be added via CLI (`bunx untitledui@latest add <component>`). See `untitled-ui.md` for the full framework reference including CLI commands, component categories, MCP integration, and theming.
</essential_principles>

<intake>
Determine the user's intent and route to the appropriate workflow:

1. Create a new component (with story) → Read `workflows/create-component.md`
2. Add stories to an existing component → Read `workflows/add-stories.md`
3. Add an Untitled UI source-owned component → Read `untitled-ui.md` for CLI commands, then follow workflow 1 for customization and story creation
4. Something else → Clarify the user's intent, then select the appropriate workflow

If the user provides a component description, default to workflow 1 (create new component).
</intake>

<reference_guides>
- `references/design-tokens.md` — Complete token reference (surfaces, text, borders, status, interactive, component-specific)
- `references/storybook-patterns.md` — CSF3 format, mock system, play functions, decorators
- `references/component-patterns.md` — Existing patterns (status badges, cards, hover states, terminals, tooltips)
- `untitled-ui.md` — Untitled UI React framework reference (CLI, components, MCP, theming, icons)
- `templates/component.tsx.md` — Component file template
- `templates/story.tsx.md` — Story file template (CSF3 with all standard variants)
</reference_guides>

<success_criteria>
- Component file created at `src/components/{domain}/{ComponentName}.tsx`
- Story file co-located at `src/components/{domain}/{ComponentName}.stories.tsx`
- No raw Tailwind colors used (no `text-gray-*`, `bg-white`, `bg-slate-*`, `border-gray-*`)
- No `dark:` Tailwind prefix used anywhere
- Icons imported from `@untitledui/icons` (not inline SVGs)
- Story includes at minimum Default and Mobile variants
- Component uses globals.css utility classes where applicable
- No purple color schemes
</success_criteria>
