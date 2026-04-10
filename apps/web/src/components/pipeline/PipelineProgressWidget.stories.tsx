import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineProgressWidget } from "./PipelineProgressWidget";

const meta = {
  title: "Pipeline/PipelineProgressWidget",
  component: PipelineProgressWidget,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineProgressWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockArgs = {
  programId: "prog_123" as any,
};

export const Default: Story = {
  args: mockArgs,
};

export const Mobile: Story = {
  args: mockArgs,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: mockArgs,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
