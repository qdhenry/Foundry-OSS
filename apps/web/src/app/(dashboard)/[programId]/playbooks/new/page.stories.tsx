import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import NewPlaybookPage from "./page";

const meta = {
  title: "Pages/Playbooks/New",
  component: NewPlaybookPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NewPlaybookPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
