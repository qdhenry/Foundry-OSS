import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { WorkstreamPipelineTab } from "./WorkstreamPipelineTab";

const meta = {
  title: "Pipeline/WorkstreamPipelineTab",
  component: WorkstreamPipelineTab,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof WorkstreamPipelineTab>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  programId: "prog_123" as any,
  workstreamId: "ws_001" as any,
  onCreateRequirement: fn(),
};

export const Default: Story = {
  args: baseArgs,
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
