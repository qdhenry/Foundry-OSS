import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import NewRiskPage from "./page";

const meta = {
  title: "Pages/Risks/New",
  component: NewRiskPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NewRiskPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
