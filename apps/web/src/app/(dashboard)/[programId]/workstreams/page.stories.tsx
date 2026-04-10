import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import WorkstreamsPage from "./page";

const meta = {
  title: "Pages/Workstreams/List",
  component: WorkstreamsPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkstreamsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "workstreams:listByProgram": [],
      "requirements:listByProgram": [],
      "tasks:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
