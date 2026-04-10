import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import NewProgramPage from "./page";

const meta = {
  title: "Pages/Programs/New",
  component: NewProgramPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NewProgramPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
