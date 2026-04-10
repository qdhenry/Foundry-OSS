import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import NewIntegrationPage from "./page";

const meta = {
  title: "Pages/Integrations/New",
  component: NewIntegrationPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NewIntegrationPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
