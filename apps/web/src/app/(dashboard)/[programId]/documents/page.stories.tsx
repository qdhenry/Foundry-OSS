import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DocumentsPage from "./page";

const meta = {
  title: "Pages/Documents/List",
  component: DocumentsPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/prog-acme-demo/documents",
        segments: [["programId", "prog-acme-demo"]],
      },
    },
  },
} satisfies Meta<typeof DocumentsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
