import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SettingsPage from "./page";

const meta = {
  title: "Pages/Settings/Settings",
  component: SettingsPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
