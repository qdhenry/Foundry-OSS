<objective>
Add Storybook stories to an existing component that doesn't have story coverage.
</objective>

<required_reading>
Before starting, read:
1. `references/storybook-patterns.md` — CSF3 format, mock system, play functions
2. `templates/story.tsx.md` — Story file template
</required_reading>

<process>

STEP 1: READ THE EXISTING COMPONENT

Read the component file to understand:
- Props interface (all props, optional vs required)
- State variations (loading, empty, error, different data shapes)
- Interactive elements (buttons, links, expandable sections)
- Whether it uses `useQuery` (needs mock data)
- Edge cases (long text, missing data, zero values)

STEP 2: IDENTIFY STORY VARIANTS

Determine which stories to create:

Always include:
- Default — Typical usage with representative data
- Mobile — `parameters.viewport.defaultViewport: "mobile"`
- Tablet — `parameters.viewport.defaultViewport: "tablet"`

Include if applicable:
- Empty — No data / empty arrays / null values
- Loading — Skeleton or loading indicator state
- Error — Error state display
- Each status variant — If the component renders differently per status (e.g., success/warning/error/info)
- Long content — Text truncation and overflow behavior
- Interaction tests — Play functions for click, expand, form interactions

STEP 3: CREATE THE STORY FILE

Read `templates/story.tsx.md` for the structural template.

File location: Co-located with the component (same directory, `.stories.tsx` extension).

Key rules:
- Import `Meta` and `StoryObj` from `@storybook/nextjs-vite`
- Title follows `"Domain/ComponentName"` taxonomy
- Include `tags: ["autodocs"]` for auto-generated documentation
- Use `fn()` from `@storybook/test` for callback props
- Add `convexMockData` parameter overrides if the component uses `useQuery`:
  ```typescript
  parameters: {
    convexMockData: {
      "tableName:queryName": mockData,
    },
  },
  ```

STEP 4: ADD PLAY FUNCTIONS FOR INTERACTIONS

For components with interactive elements, add play functions:

```typescript
import { expect, fn, userEvent, within } from "@storybook/test";

export const ClickAction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /action/i });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

STEP 5: VERIFY

After creating the story file:
1. Confirm all exported stories have unique names
2. Confirm Mobile and Tablet variants set the viewport parameter
3. Confirm callback props use `fn()` for mocking
4. Tell the user to verify in Storybook: `bun run storybook`

</process>

<success_criteria>
- Story file co-located with component (`.stories.tsx`)
- Default, Mobile, and Tablet variants present
- All callback props mocked with `fn()`
- `tags: ["autodocs"]` included
- Title follows `"Domain/ComponentName"` taxonomy
- Convex mock data configured if component uses `useQuery`
</success_criteria>
