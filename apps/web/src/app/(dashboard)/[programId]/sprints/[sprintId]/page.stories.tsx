import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SprintDetailPage from "./page";

const meta = {
  title: "Pages/Sprints/Detail",
  component: SprintDetailPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SprintDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
