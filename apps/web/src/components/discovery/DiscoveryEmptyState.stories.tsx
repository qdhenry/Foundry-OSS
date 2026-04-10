import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { DiscoveryEmptyState } from "./DiscoveryEmptyState";

const meta: Meta<typeof DiscoveryEmptyState> = {
  title: "Discovery/DiscoveryEmptyState",
  component: DiscoveryEmptyState,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onCreateRequirement: fn(),
    onOpenDocuments: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DiscoveryEmptyState>;

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {};

export const OpenDocumentsAction: Story = {
  name: "Interaction — Open Document Zone",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole("button", { name: /open document zone/i });
    await expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    await expect(args.onOpenDocuments).toHaveBeenCalledTimes(1);
  },
};

export const CreateRequirementAction: Story = {
  name: "Interaction — Create Requirement",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole("button", { name: /create requirement/i });
    await expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    await expect(args.onCreateRequirement).toHaveBeenCalledTimes(1);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
