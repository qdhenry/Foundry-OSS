<objective>
Create a new UI component with design-system compliance and a co-located Storybook story file.
</objective>

<required_reading>
Before starting, read these reference files:
1. `references/design-tokens.md` — Available tokens for colors, surfaces, text, borders, status, interactive states
2. `references/component-patterns.md` — Existing patterns in the codebase (status badges, cards, hover states, icons)
3. `untitled-ui.md` — Untitled UI React framework reference (for CLI-added source components, icon system, theming)
</required_reading>

<process>

STEP 1: GATHER REQUIREMENTS

Determine (ask if not provided):
- Component name — PascalCase (e.g., `StatusCard`, `MetricBadge`)
- Purpose — What does this component do?
- Props — What data does it accept? What callbacks?
- Domain — Which directory? (`dashboard`, `sandbox`, `discovery`, `tasks`, `skills`, `risks`, `shared`, etc.)
- Interactive? — Does it have click handlers, state, or hooks? (determines `"use client"`)
- Untitled UI base? — Should this extend or wrap an Untitled UI source component? If so, add it first via `bunx untitledui@latest add <component> --yes`

STEP 2: CHECK EXISTING COMPONENTS

Search for similar components to reuse patterns:
- Glob: `src/components/{domain}/**/*.tsx`
- Grep: pattern matching component purpose

STEP 3: CREATE THE COMPONENT

Read `templates/component.tsx.md` for the structural template.

File location: `src/components/{domain}/{ComponentName}.tsx`

Key rules:
- All colors/backgrounds/borders use design tokens (read `references/design-tokens.md`)
- Icons imported individually from `@untitledui/icons`
- Export as named export (not default)
- Props interface defined and exported
- Use globals.css utility classes (`.card`, `.btn-primary`, `.badge`, etc.) where they apply
- No `dark:` prefix — tokens handle both themes automatically

STEP 4: CREATE THE STORY

Read `references/storybook-patterns.md` and `templates/story.tsx.md`.

File location: `src/components/{domain}/{ComponentName}.stories.tsx`

Standard variants to include:
- Default — Component with typical data
- Empty — Component with no/empty data (if applicable)
- Loading — Skeleton/loading state (if applicable)
- Mobile — With `parameters.viewport.defaultViewport: "mobile"`
- Tablet — With `parameters.viewport.defaultViewport: "tablet"`

Add interaction stories (play functions) for:
- Click handlers
- Expand/collapse behavior
- Hover states that reveal content
- Form interactions

Add `convexMockData` parameter overrides if the component uses `useQuery`.

STEP 5: VERIFY

After creating both files:
1. Confirm no raw Tailwind colors are used (no `text-gray-*`, `bg-white`, `bg-slate-*`, `border-gray-*`, etc.)
2. Confirm no `dark:` prefix usage
3. Confirm icons are imported from `@untitledui/icons`
4. Confirm the story has at least Default and Mobile variants
5. Tell the user they can verify in Storybook:
   - `bun run storybook`
   - Use the theme toolbar toggle (sun/moon icons) to check light and dark
   - Use "Side by Side" mode to compare both themes simultaneously

</process>

<success_criteria>
- Component file exists at correct path
- Story file co-located with component
- Zero raw Tailwind color classes
- Zero `dark:` prefix usage
- Icons from `@untitledui/icons` only
- Story has Default + Mobile variants minimum
- Named export (not default)
- Props interface exported
</success_criteria>
