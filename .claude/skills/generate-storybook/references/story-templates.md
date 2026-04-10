<overview>
CSF3 story templates for the Foundry codebase. Every story file follows these patterns with full coverage: visual variants, interaction tests, accessibility assertions, and responsive viewports.
</overview>

<csf3_component_template>
**Standard component story template:**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent, fn } from "@storybook/test";
import { ComponentName } from "./ComponentName";

const meta = {
  title: "DomainName/ComponentName",
  component: ComponentName,
  tags: ["autodocs"],
  parameters: {
    layout: "centered", // or "fullscreen" for page-level components
  },
  decorators: [
    // Add as needed:
    // ConvexMockDecorator, ClerkMockDecorator, RouterDecorator
  ],
  args: {
    // Default props with realistic mock data
  },
  argTypes: {
    // Document prop controls for Storybook UI
  },
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Visual Variants ---

export const Default: Story = {};

export const Loading: Story = {
  args: {
    // loading state props
  },
};

export const Empty: Story = {
  args: {
    // empty state props (no data)
  },
};

export const Error: Story = {
  args: {
    // error state props
  },
};

// --- Interaction Tests ---

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find interactive elements
    const button = canvas.getByRole("button", { name: /submit/i });

    // Perform interactions
    await userEvent.click(button);

    // Assert results
    await expect(button).toBeDisabled();
  },
};

// --- Accessibility Assertions ---

export const AccessibilityCheck: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify ARIA labels
    const nav = canvas.getByRole("navigation");
    await expect(nav).toBeInTheDocument();

    // Verify focus management
    const firstInput = canvas.getByRole("textbox");
    await userEvent.tab();
    await expect(firstInput).toHaveFocus();
  },
};

// --- Responsive Viewports ---

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const Desktop: Story = {
  parameters: {
    viewport: { defaultViewport: "desktop" },
  },
};
```
</csf3_component_template>

<csf3_page_template>
**Page-level story template (for `page.tsx` routes):**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import PageComponent from "./page";

const meta = {
  title: "Pages/RoutePath/PageName",
  component: PageComponent,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    // Pages almost always need all three decorators:
    // RouterDecorator (with mock params), ConvexMockDecorator, ClerkMockDecorator
  ],
} satisfies Meta<typeof PageComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
```

**Important for pages:**
- Mock all dynamic route params (`[programId]`, `[skillId]`, etc.) in the RouterDecorator
- Mock all Convex queries the page calls (inspect imports to find them)
- Use `layout: "fullscreen"` since pages render full-width
- Title format: `Pages/{RouteGroup}/{PageName}` (e.g., `Pages/Programs/SkillDetail`)
</csf3_page_template>

<mock_data_patterns>
**Convex query mocking:**

```tsx
// Create a decorator that provides mock data for Convex queries
import { ConvexProvider } from "convex/react";

const mockConvexClient = {
  // Mock queries return static data
  // Mock mutations use fn() for assertion
};

export const ConvexMockDecorator = (Story) => (
  <ConvexProvider client={mockConvexClient as any}>
    <Story />
  </ConvexProvider>
);
```

**Clerk auth mocking:**

```tsx
import { ClerkProvider } from "@clerk/nextjs";

export const ClerkMockDecorator = (Story) => (
  // Use Clerk's testing tokens or a mock provider
  // Provide a fake user with orgId for multi-tenant testing
  <Story />
);
```

**Router param mocking:**

```tsx
// Mock Next.js App Router hooks
export const RouterDecorator = (Story) => {
  // Mock useParams to return { programId: "test-program-123" }
  // Mock useRouter to return push/replace stubs
  // Mock usePathname to return current route
  return <Story />;
};
```

**Realistic mock data guidelines:**
- Use AcmeCorp reference data where applicable (program names, requirement titles)
- Generate realistic IDs: `"prog_abc123"`, `"req_def456"`
- Use realistic dates within the last 30 days
- Match Convex schema types exactly (check `convex/schema.ts`)
- Provide enough items to show lists (3-5 items minimum)
</mock_data_patterns>

<interaction_patterns>
**Common interactive element patterns:**

<pattern name="button_click">
```tsx
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const button = canvas.getByRole("button", { name: /save/i });
  await userEvent.click(button);
  await expect(button).toBeDisabled(); // or check for state change
},
```
</pattern>

<pattern name="form_fill">
```tsx
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const input = canvas.getByRole("textbox", { name: /name/i });
  await userEvent.clear(input);
  await userEvent.type(input, "Test requirement");
  await expect(input).toHaveValue("Test requirement");
},
```
</pattern>

<pattern name="dropdown_select">
```tsx
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const select = canvas.getByRole("combobox");
  await userEvent.click(select);
  const option = canvas.getByRole("option", { name: /high/i });
  await userEvent.click(option);
},
```
</pattern>

<pattern name="toggle_switch">
```tsx
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole("switch");
  await expect(toggle).not.toBeChecked();
  await userEvent.click(toggle);
  await expect(toggle).toBeChecked();
},
```
</pattern>

<pattern name="modal_open_close">
```tsx
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole("button", { name: /open/i });
  await userEvent.click(trigger);
  const dialog = canvas.getByRole("dialog");
  await expect(dialog).toBeInTheDocument();
  const close = within(dialog).getByRole("button", { name: /close/i });
  await userEvent.click(close);
},
```
</pattern>

<pattern name="tab_navigation">
```tsx
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const tabs = canvas.getAllByRole("tab");
  await userEvent.click(tabs[1]);
  await expect(tabs[1]).toHaveAttribute("aria-selected", "true");
},
```
</pattern>
</interaction_patterns>

<viewport_config>
**Viewport presets used across all stories:**

```tsx
// Defined in .storybook/preview.ts
const customViewports = {
  mobile: {
    name: "Mobile",
    styles: { width: "375px", height: "812px" },
  },
  tablet: {
    name: "Tablet",
    styles: { width: "768px", height: "1024px" },
  },
  desktop: {
    name: "Desktop",
    styles: { width: "1280px", height: "800px" },
  },
};
```
</viewport_config>

<title_conventions>
**Story title hierarchy:**

Components: `{Domain}/{ComponentName}`
- `Dashboard/KpiCards`
- `Discovery/RequirementsTable`
- `Sandbox/SandboxHUD`

Pages: `Pages/{RouteGroup}/{PageName}`
- `Pages/Programs/ProgramList`
- `Pages/Dashboard/MissionControl`
- `Pages/Sandbox/SandboxManager`

Wizard steps: `Programs/Wizard/{StepName}`
- `Programs/Wizard/DocumentUploadStep`
- `Programs/Wizard/AnalysisStep`
</title_conventions>
