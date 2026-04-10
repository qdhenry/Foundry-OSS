import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import IntegrationDetailPage from "./page";

const meta = {
  title: "Pages/Integrations/Detail",
  component: IntegrationDetailPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof IntegrationDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
