---
description: Generate comprehensive Storybook stories for a component or all components in a directory
argument-hint: <component-path-or-directory>
---

<objective>
Generate comprehensive Storybook stories for the component(s) at `$ARGUMENTS`.

If the path points to a single `.tsx` file, generate stories for that component.
If the path points to a directory, find all `.tsx` component files in that directory (excluding existing `.stories.tsx`, `index.ts`, test files, and type-only files) and generate stories for each.

Stories must match this project's established patterns exactly — using `@storybook/nextjs-vite`, Convex mock data via `parameters.convexMockData`, the ThemeProvider decorator, and AcmeCorp demo data.
</objective>

<context>
Storybook config: @.storybook/main.ts
Preview/decorators: @.storybook/preview.tsx
Convex mocks (default data + useQuery/useMutation mocks): @.storybook/mocks/convex.ts
Program context mock: @.storybook/mocks/program-context.tsx

Reference stories for patterns:
- Component story with props/variants/play tests: @src/components/tasks/TaskCard.stories.tsx
- Component story with interactive flows: @src/components/gates/ApprovalPanel.stories.tsx
</context>

<process>
For each component file found at `$ARGUMENTS`:

1. **Read the component source** to understand:
   - Exported component name and its props interface/type
   - All union/literal types in props (status, priority, variant, size, etc.)
   - Optional vs required props
   - Whether it uses `useQuery`/`useMutation` from Convex (needs `convexMockData` parameter)
   - Whether it uses `useProgramContext` (already mocked globally)
   - Whether it uses Next.js routing (`useParams`, `useRouter`, `usePathname`)
   - Children/render prop patterns
   - Internal conditional rendering branches (empty states, loading, error)

2. **Create the story file** at the same directory as the component, named `ComponentName.stories.tsx`. Follow these exact conventions:

   **Imports:**
   ```tsx
   import type { Meta, StoryObj } from "@storybook/nextjs-vite";
   import { userEvent, within, expect } from "@storybook/test";
   import { ComponentName } from "./ComponentName";
   ```

   **Meta configuration:**
   ```tsx
   const meta: Meta<typeof ComponentName> = {
     title: "Category/ComponentName",  // Match directory structure
     component: ComponentName,
     tags: ["autodocs"],
     parameters: {
       layout: "padded",  // or "fullscreen" for full-page components
     },
     argTypes: {
       // Map each prop to appropriate control type
     },
   };
   export default meta;
   type Story = StoryObj<typeof ComponentName>;
   ```

   **Title convention:** Use the directory name under `src/components/` or `src/app/` as the category. Examples:
   - `src/components/gates/ApprovalPanel.tsx` → `"Gates/ApprovalPanel"`
   - `src/components/dashboard/KpiCards.tsx` → `"Dashboard/KpiCards"`
   - `src/app/(dashboard)/[programId]/tasks/page.tsx` → `"Pages/Tasks"`

   **Required stories to generate (in order):**

   a. **Default** — Component with typical/happy-path props
   b. **All enum/union variants** — One story per value for each union-type prop (status, priority, variant, size, type, etc.). Name them `"PropName — Value"` using the `name` field.
   c. **Empty state** — If the component handles empty data (empty arrays, null values, no children)
   d. **Loading state** — If the component has a loading prop or renders a skeleton
   e. **Error state** — If the component has an error prop or error boundary
   f. **Edge cases:**
      - Long text/titles (truncation behavior)
      - Minimal data (only required props, no optional ones)
      - Maximum data (all optional props provided, large arrays)
   g. **Interactive stories with `play` functions** — For components with buttons, forms, dropdowns, toggles:
      ```tsx
      play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Use findByRole, findByText, findByPlaceholderText
        // Use userEvent.click, userEvent.type
        // Use expect assertions
      };
      ```
   h. **Responsive viewport stories:**
      ```tsx
      export const Mobile: Story = {
        args: { /* same as Default */ },
        parameters: { viewport: { defaultViewport: "mobile1" } },
      };
      export const Tablet: Story = {
        args: { /* same as Default */ },
        parameters: { viewport: { defaultViewport: "tablet" } },
      };
      ```

   **Convex mock data (when component uses useQuery):**
   ```tsx
   export const CustomData: Story = {
     args: { /* ... */ },
     parameters: {
       convexMockData: {
         "module:functionName": customMockValue,
       },
     },
   };
   ```

   **Shared mock data:** Extract reusable mock objects to `const` variables above the stories section, using AcmeCorp themed data (the project's demo dataset).

3. **Verify the story file** compiles by checking:
   - All imports resolve correctly
   - Props match the component's actual interface
   - Mock data shapes match Convex schema expectations
   - No TypeScript errors in the generated code

4. **Skip components that already have a `.stories.tsx` file** unless the existing file is empty or only has a Default story. In that case, enhance the existing file rather than overwriting it.
</process>

<success_criteria>
- Every component at the given path has a comprehensive `.stories.tsx` file
- Each story file includes: Default, all enum variants, empty/edge cases, interactive play tests, and responsive viewport stories
- Stories use `@storybook/nextjs-vite` imports (NOT `@storybook/react`)
- Stories follow the exact Meta/StoryObj pattern from the reference stories
- Components using Convex hooks have appropriate `convexMockData` parameters
- Mock data uses AcmeCorp themed content consistent with `.storybook/mocks/convex.ts`
- All story files pass TypeScript compilation
- Interactive `play` functions use `within(canvasElement)` + `findBy*` queries (not `getBy*`) for async safety
</success_criteria>

<output>
Files created/modified:
- `{componentDir}/{ComponentName}.stories.tsx` for each component found at the given path
</output>
