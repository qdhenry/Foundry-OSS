import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PlaybookDetailPage from "./page";

const meta = {
  title: "Pages/Playbooks/Detail",
  component: PlaybookDetailPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PlaybookDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
