import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { NotificationBell } from "./NotificationBell";

// NotificationBell uses useQuery / useMutation from convex/react.
// Both are globally mocked in Storybook via the convex mock setup in preview.tsx.
// The mock returns `undefined` by default (loading state).
// Individual stories can override the mock return values via parameters or
// by decorating with a custom Convex mock provider if available.

const meta = {
  title: "Layout/NotificationBell",
  component: NotificationBell,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/dashboard",
      },
    },
  },
} satisfies Meta<typeof NotificationBell>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default — convex mock returns undefined (loading state, no badge shown)
export const Default: Story = {};

// Shows the bell in a container that simulates the header toolbar position
export const InHeaderToolbar: Story = {
  name: "In Header Toolbar",
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2 rounded-lg border border-border-default px-4 py-2 bg-surface-default">
        <span className="text-sm text-text-muted">Toolbar context</span>
        <Story />
      </div>
    ),
  ],
};

// Play function: open the dropdown panel by clicking the bell
export const DropdownOpen: Story = {
  name: "Dropdown Open (interaction)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bellButton = canvas.getByRole("button", { name: /notifications/i });
    await userEvent.click(bellButton);
  },
};

// Play function: open then close via Escape key
export const DropdownClosedByEscape: Story = {
  name: "Dropdown Close via Escape",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bellButton = canvas.getByRole("button", { name: /notifications/i });
    await userEvent.click(bellButton);
    await userEvent.keyboard("{Escape}");
  },
};

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
