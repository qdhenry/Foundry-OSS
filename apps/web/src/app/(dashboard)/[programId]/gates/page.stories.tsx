import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GatesPage from "./page";

const meta = {
  title: "Pages/Gates/List",
  component: GatesPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof GatesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "sprintGates:listByProgram": [],
      "workstreams:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
