import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { RequirementPipelinePanel } from "./RequirementPipelinePanel";

const meta = {
  title: "Pipeline/RequirementPipelinePanel",
  component: RequirementPipelinePanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof RequirementPipelinePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  requirementId: "req_001" as any,
  programId: "prog_123" as any,
  workstreamId: "ws_001" as any,
  onClose: fn(),
};

export const Default: Story = {
  args: baseArgs,
};

export const WithDiscoveryReferrer: Story = {
  args: {
    ...baseArgs,
    referrer: "discovery",
  },
};

export const Mobile: Story = {
  args: baseArgs,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: baseArgs,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const ClosePanel: Story = {
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Find close button (X icon button in top right)
    const closeButtons = canvas.getAllByRole("button");
    const closeButton = closeButtons.find(
      (btn) => btn.className.includes("rounded-lg") && btn.querySelector("svg"),
    );
    if (closeButton) {
      await userEvent.click(closeButton);
    }
  },
};
