import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import IntegrationsPage from "./page";

const meta = {
  title: "Pages/Integrations/List",
  component: IntegrationsPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof IntegrationsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "integrations:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
