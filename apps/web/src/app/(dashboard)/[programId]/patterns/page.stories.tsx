import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PatternsPage from "./page";

const meta = {
  title: "Pages/Patterns/List",
  component: PatternsPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PatternsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "sourceControl.patterns.snippetStorage:listSnippets": [],
    },
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
