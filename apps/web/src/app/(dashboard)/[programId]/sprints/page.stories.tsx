import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SprintsPage from "./page";

const meta = {
  title: "Pages/Sprints/List",
  component: SprintsPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SprintsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "sprints:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
