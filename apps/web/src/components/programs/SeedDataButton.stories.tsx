import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { SeedDataButton } from "./SeedDataButton";

const meta: Meta<typeof SeedDataButton> = {
  title: "Programs/SeedDataButton",
  component: SeedDataButton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    orgId: "org_demo_001",
  },
};

export default meta;
type Story = StoryObj<typeof SeedDataButton>;

export const Default: Story = {
  name: "Default — Idle State",
};

export const ClickToSeed: Story = {
  name: "Interactive — Click to Load Demo Data",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /load demo data/i });
    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
