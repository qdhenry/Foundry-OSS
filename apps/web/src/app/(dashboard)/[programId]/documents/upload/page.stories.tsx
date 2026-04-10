import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DocumentUploadPage from "./page";

const meta = {
  title: "Pages/Documents/Upload",
  component: DocumentUploadPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/prog-acme-demo/documents/upload",
        segments: [["programId", "prog-acme-demo"]],
      },
    },
  },
} satisfies Meta<typeof DocumentUploadPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
