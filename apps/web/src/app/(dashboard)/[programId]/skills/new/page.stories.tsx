import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import NewSkillPage from "./page";

const meta = {
  title: "Pages/Skills/New",
  component: NewSkillPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/skills/new",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
} satisfies Meta<typeof NewSkillPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
