import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import RisksPage from "./page";

const meta = {
  title: "Pages/Risks/List",
  component: RisksPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RisksPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "risks:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
