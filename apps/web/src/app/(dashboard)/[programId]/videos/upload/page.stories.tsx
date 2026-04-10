import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import VideoUploadPage from "./page";

const meta = {
  title: "Pages/Videos/Upload",
  component: VideoUploadPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof VideoUploadPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
