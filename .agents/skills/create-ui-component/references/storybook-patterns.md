<overview>
Storybook patterns reference for the Foundry platform. Uses Storybook 10 with `@storybook/nextjs-vite` framework. Stories use CSF3 format.
</overview>

<csf3_format>
```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ComponentName } from "./ComponentName";

const meta: Meta<typeof ComponentName> = {
  title: "Domain/ComponentName",
  component: ComponentName,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",  // or "centered" or "fullscreen"
  },
};

export default meta;
type Story = StoryObj<typeof ComponentName>;

export const Default: Story = {
  args: {
    // component props
  },
};
```

Alternative: `satisfies Meta<typeof ComponentName>` for stricter type checking:
```typescript
const meta = {
  title: "Domain/ComponentName",
  component: ComponentName,
  tags: ["autodocs"],
} satisfies Meta<typeof ComponentName>;
```
</csf3_format>

<title_taxonomy>
- Components: `"Domain/ComponentName"` (e.g., `"Dashboard/KpiCards"`, `"Discovery/FindingCard"`)
- Pages: `"Pages/Domain/Main"` (e.g., `"Pages/Dashboard/Main"`)
</title_taxonomy>

<standard_variants>
Every story file should include at minimum:

```typescript
// Required
export const Default: Story = { args: { /* typical data */ } };

// Responsive
export const Mobile: Story = {
  args: { /* same as Default */ },
  parameters: { viewport: { defaultViewport: "mobile" } },
};
export const Tablet: Story = {
  args: { /* same as Default */ },
  parameters: { viewport: { defaultViewport: "tablet" } },
};

// Conditional (include if applicable)
export const Empty: Story = { args: { /* empty/null data */ } };
export const Loading: Story = { args: { isLoading: true } };
```

Viewport names use the custom Foundry presets: `"mobile"` (375x812), `"tablet"` (768x1024), `"desktop"` (1280x800).
</standard_variants>

<callback_mocking>
Mock callback props with `fn()` from `@storybook/test`:

```typescript
import { fn } from "@storybook/test";

const meta: Meta<typeof ComponentName> = {
  // ...
  args: {
    onClick: fn(),
    onSubmit: fn(),
    onChange: fn(),
  },
};
```
</callback_mocking>

<convex_mock_data>
Components using `useQuery` get mock data from the global mock system. Override per-story:

```typescript
export const CustomData: Story = {
  parameters: {
    convexMockData: {
      "programs:get": { _id: "custom", name: "Custom Program", /* ... */ },
      "workstreams:listByProgram": [],
    },
  },
};
```

Key format: `"module:functionName"` matching Convex function paths:
- `"programs:get"`, `"programs:list"`
- `"workstreams:listByProgram"`
- `"requirements:listByProgram"`
- `"sourceControl/repositories:listByProgram"`

Default mock data is defined in `.storybook/mocks/convex.ts` and exported for reuse:
```typescript
import { MOCK_PROGRAM, MOCK_WORKSTREAMS } from "../../../.storybook/mocks/convex";
```
</convex_mock_data>

<play_functions>
```typescript
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";

export const ClickInteraction: Story = {
  args: {
    onClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click an element
    const button = canvas.getByRole("button", { name: /submit/i });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};

export const TypeInteraction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText(/search/i);
    await userEvent.type(input, "hello world");
    await expect(input).toHaveValue("hello world");
  },
};

export const ExpandCollapse: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: /show more/i });
    await expect(toggle).toBeInTheDocument();
    await userEvent.click(toggle);
    await expect(canvas.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  },
};
```
</play_functions>

<render_function>
For components needing local state wrapping:

```typescript
export const WithLocalState: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return <ComponentName value={value} onChange={setValue} />;
  },
};
```
</render_function>

<theme_handling>
Theme switching is handled globally by the Storybook decorator in `.storybook/preview.tsx`. No per-story theme configuration needed. The toolbar provides:
- Light mode
- Dark mode
- Side by Side — renders both themes in a grid for comparison
</theme_handling>

<viewports>
Custom Foundry viewports (defined in `.storybook/preview.tsx`):
- `mobile`: 375x812
- `tablet`: 768x1024
- `desktop`: 1280x800

Usage: `parameters: { viewport: { defaultViewport: "mobile" } }`
</viewports>

<addons>
- `@storybook/addon-docs` — Auto-generated documentation via `tags: ["autodocs"]`
- `@storybook/addon-vitest` — Vitest integration for play function tests
- `@storybook/addon-a11y` — Accessibility checks
</addons>

<mock_aliases>
The Storybook vite config aliases these modules to mocks:
- `convex/react` → `.storybook/mocks/convex.ts`
- `convex/react-clerk` → `.storybook/mocks/convex-react-clerk.ts`
- `@clerk/nextjs` → `.storybook/mocks/clerk.ts`
- `@/lib/programContext` → `.storybook/mocks/program-context.tsx`

Components using these imports work automatically in Storybook without additional setup.
</mock_aliases>
