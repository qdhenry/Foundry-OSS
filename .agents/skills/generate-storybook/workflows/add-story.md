<required_reading>
**Read these reference files NOW:**
1. references/story-templates.md
</required_reading>

<process>

**Step 1: Identify the target component**

If the user specified a component path, use it directly. Otherwise, ask:
"Which component needs a story? Provide the file path (e.g., `src/components/dashboard/KpiCards.tsx`)."

**Step 2: Read the component source**

Read the target `.tsx` file. Identify:
- Component name and export type (default vs named)
- Props interface/type
- Interactive elements (buttons, inputs, selects, toggles, links)
- Data dependencies (useQuery, useMutation hooks from Convex)
- Auth dependencies (useUser, useOrganization from Clerk)
- Router dependencies (useParams, useRouter, usePathname)
- Visual variants (conditional styling, size/color props, loading/error states)

**Step 3: Determine required decorators**

Based on dependencies found:
- Convex hooks present → add `ConvexMockDecorator`
- Clerk hooks present → add `ClerkMockDecorator`
- Router hooks present → add `RouterDecorator`

**Step 4: Generate the story file**

Use the CSF3 template from `references/story-templates.md`. The story MUST include:

1. **Default story** — Primary variant with realistic mock data
2. **Variant stories** — One per significant prop combination (loading, error, empty state, etc.)
3. **Interactive story** — Play function that exercises all interactive elements
4. **Accessibility story** — Assertions for ARIA labels, focus management, keyboard navigation
5. **Responsive stories** — Mobile (375px), Tablet (768px), Desktop (1280px) viewport parameters

Write the story file adjacent to the component: `ComponentName.stories.tsx`.

**Step 5: Verify the story compiles**

Run a quick type check:
```bash
npx tsc --noEmit src/components/{domain}/{ComponentName}.stories.tsx 2>&1
```

If there are type errors, fix them immediately.

</process>

<success_criteria>
- Story file created adjacent to the component
- Uses CSF3 format with typed `Meta` and `StoryObj`
- Includes Default, variant, interactive, accessibility, and responsive stories
- All necessary mock decorators applied
- Story compiles without type errors
</success_criteria>
