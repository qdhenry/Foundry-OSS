import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { CommandPalette } from "./CommandPalette";

const meta: Meta<typeof CommandPalette> = {
  title: "Search/CommandPalette",
  component: CommandPalette,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    onClose: { action: "onClose" },
  },
};

export default meta;
type Story = StoryObj<typeof CommandPalette>;

export const Default: Story = {
  args: {
    onClose: () => {},
  },
};

export const WithSearchQuery: Story = {
  args: {
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByPlaceholderText(/search requirements, skills, risks/i);
    await userEvent.type(input, "Acme", { delay: 60 });
  },
};

export const ShortQuery: Story = {
  args: {
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByPlaceholderText(/search requirements, skills, risks/i);
    await userEvent.type(input, "a", { delay: 60 });
  },
};

export const EscapeKeyDismiss: Story = {
  args: {
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByPlaceholderText(/search requirements, skills, risks/i);
    await userEvent.click(input);
    await userEvent.keyboard("{Escape}");
  },
};

export const Mobile: Story = {
  args: {
    onClose: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const Tablet: Story = {
  args: {
    onClose: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
