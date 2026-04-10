<required_reading>
**Read these reference files NOW:**
1. references/foundry-component-map.md
2. references/story-templates.md
</required_reading>

<process>

**Step 1: Discover all component files**

Scan the codebase for all `.tsx` files that need stories:

```bash
find src/components -name "*.tsx" ! -name "*.test.tsx" ! -name "*.stories.tsx" ! -name "index.tsx" | sort
find src/app -name "page.tsx" | sort
```

Build a manifest of files grouped by domain directory. Skip files that are:
- Test files (`*.test.tsx`)
- Existing stories (`*.stories.tsx`)
- Barrel exports (`index.tsx`, `index.ts`)
- Type-only files (files with only `type`/`interface` exports and no JSX)

**Step 2: Group files into subagent batches**

Group discovered files by their parent domain directory. The 25 component domains are:

`ai`, `ai-features`, `audit`, `comments`, `coordination`, `dashboard`, `discovery`, `documents`, `gates`, `integrations`, `layout`, `mission-control`, `pipeline`, `pipeline-lab`, `playbooks`, `programs`, `risks`, `sandbox`, `search`, `shared`, `skills`, `source-control`, `sprints`, `tasks`, `videos`

Pages form a separate batch: `pages`.

**Step 3: Deploy subagents in parallel waves**

Deploy subagents using the Task tool with `subagent_type: "builder"`. Run up to **6 concurrent subagents** per wave.

Each subagent receives this prompt template (fill in the domain-specific values):

```
You are generating Storybook stories for the Foundry application.

DOMAIN: {domain_name}
FILES TO PROCESS:
{list of .tsx file paths}

For EACH file listed above:
1. Read the component file to understand its props, variants, and interactive elements
2. Generate a `.stories.tsx` file placed adjacent to the component
3. Follow CSF3 format (Component Story Format 3)

EVERY story file MUST include:
- A `meta` export with title organized as "{Domain}/{ComponentName}"
- A `Default` story showing the primary variant
- Additional variant stories for each significant prop combination
- Play functions for interactive elements (buttons, inputs, dropdowns, toggles)
- Accessibility assertions using `expect` from `@storybook/test`
- Responsive viewport stories: Mobile (375px), Tablet (768px), Desktop (1280px)

MOCK PATTERNS:
- Import Convex mock decorator: wrap stories needing data with ConvexMockDecorator
- Import Clerk mock decorator: wrap stories needing auth with ClerkMockDecorator
- Import Router decorator: wrap stories needing routing with RouterDecorator
- For useQuery hooks: provide mock data that matches the Convex schema types
- For useMutation hooks: use fn() from @storybook/test

STORY TEMPLATE (adapt per component):
```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent, fn } from "@storybook/test";
import { ComponentName } from "./ComponentName";

const meta = {
  title: "{Domain}/{ComponentName}",
  component: ComponentName,
  tags: ["autodocs"],
  decorators: [/* add needed decorators */],
  args: {
    /* default props */
  },
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithVariant: Story = {
  args: { /* variant props */ },
};

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // interaction test
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};

export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: "tablet" } },
};
```

Write each story file using the Write tool. Do NOT skip any component.
```

**Wave scheduling:**
- Wave 1: 6 largest domains (by file count)
- Wave 2: Next 6 domains
- Wave 3: Next 6 domains
- Wave 4: Next 6 domains
- Wave 5: Remaining domains + pages batch

Wait for each wave to complete before starting the next.

**Step 4: Generate page stories**

Pages require special handling since they are full route compositions:

- Mock all route params (`[programId]`, `[skillId]`, etc.) via the Router decorator
- Mock Convex queries that the page depends on
- Title format: `Pages/{RoutePath}` (e.g., `Pages/Dashboard/Skills`)
- Include responsive viewport stories

Deploy a subagent for pages using the same Task tool pattern.

**Step 5: Validate generated stories**

After all subagents complete, verify:

```bash
# Count generated story files
find src -name "*.stories.tsx" | wc -l

# Attempt a Storybook build to catch compilation errors
npx storybook build --quiet 2>&1 | tail -20
```

If any stories fail to compile, fix them directly. Common issues:
- Missing imports for mock decorators
- Incorrect prop types (read the component source to verify)
- Missing Convex query mock data

**Step 6: Report results**

Present the user with:
- Total components processed
- Total stories generated
- Any components that were skipped (with reasons)
- Any build errors that need manual attention

</process>

<success_criteria>
- Every `.tsx` component in `src/components/` has a corresponding `.stories.tsx`
- Every `page.tsx` in `src/app/` has a corresponding `.stories.tsx`
- All stories use CSF3 format with proper meta exports
- Play functions exist for all interactive components
- Accessibility assertions included in interactive stories
- Responsive viewport stories (mobile, tablet, desktop) on every story file
- `storybook build` completes without errors
</success_criteria>
