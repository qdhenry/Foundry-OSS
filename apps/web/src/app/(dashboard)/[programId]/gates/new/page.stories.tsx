import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CreateGatePage from "./page";

const meta = {
  title: "Pages/Gates/New",
  component: CreateGatePage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CreateGatePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
