import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PlaybooksPage from "./page";

const meta = {
  title: "Pages/Playbooks/List",
  component: PlaybooksPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PlaybooksPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "playbooks:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
