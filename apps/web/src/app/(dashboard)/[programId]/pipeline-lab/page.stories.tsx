import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PipelineLabPage from "./page";

const meta = {
  title: "Pages/PipelineLab/Main",
  component: PipelineLabPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PipelineLabPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
