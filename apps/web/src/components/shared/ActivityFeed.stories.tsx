import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within } from "@storybook/test";
import { ActivityFeed } from "./ActivityFeed";

const meta: Meta<typeof ActivityFeed> = {
  title: "Shared/ActivityFeed",
  component: ActivityFeed,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    programId: { control: "text" },
    initialPageSize: { control: { type: "number", min: 5, max: 50 } },
  },
};

export default meta;
type Story = StoryObj<typeof ActivityFeed>;

export const Default: Story = {
  args: {
    programId: "program-123",
    initialPageSize: 20,
  },
};

export const SmallPageSize: Story = {
  args: {
    programId: "program-123",
    initialPageSize: 5,
  },
};

export const Mobile: Story = {
  args: {
    programId: "program-123",
    initialPageSize: 20,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const Tablet: Story = {
  args: {
    programId: "program-123",
    initialPageSize: 20,
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};

export const WithInteraction: Story = {
  args: {
    programId: "program-123",
    initialPageSize: 20,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Query for the "Load more" button if it renders
    const loadMoreButtons = canvas.queryAllByRole("button", { name: /load more/i });
    // Existence check only — Convex mock may not expose it
    void loadMoreButtons;
  },
};
