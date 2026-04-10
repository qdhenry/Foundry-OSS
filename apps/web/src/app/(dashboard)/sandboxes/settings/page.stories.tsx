import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SandboxesSettingsRoute from "./page";

const meta = {
  title: "Pages/Sandboxes/Settings",
  component: SandboxesSettingsRoute,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SandboxesSettingsRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
