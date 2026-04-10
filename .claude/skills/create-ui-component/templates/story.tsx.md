<template>
```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { ComponentName } from "./ComponentName";

// ── Meta ─────────────────────────────────────────────────────────────

const meta: Meta<typeof ComponentName> = {
  title: "Domain/ComponentName",
  component: ComponentName,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    // Default args shared across stories
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ComponentName>;

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    title: "Example Title",
    // ... typical props
  },
};

export const Empty: Story = {
  args: {
    title: "",
    // ... empty/null/minimal data
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const Mobile: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

// ── Interaction Stories (if applicable) ──────────────────────────────

export const ClickAction: Story = {
  args: {
    ...Default.args,
    onClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /action/i });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};

// ── With Convex Mock Data (if component uses useQuery) ───────────────

export const CustomData: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    convexMockData: {
      "tableName:queryName": { /* mock data */ },
    },
  },
};
```
</template>

<notes>
- Replace `Domain/ComponentName` with the actual title (e.g., `"Dashboard/KpiCards"`)
- Replace `ComponentName` with the actual component
- Remove `Empty` / `Loading` stories if the component doesn't have those states
- Remove `ClickAction` if no interactive elements
- Remove `CustomData` if the component doesn't use `useQuery`
- Always include `Default`, `Mobile`, and `Tablet` at minimum
- Use `fn()` for all callback props in `args`
- Import `expect`, `userEvent`, `within` only if writing play functions
- Viewport names use custom Foundry presets: `"mobile"`, `"tablet"`, `"desktop"`
</notes>
