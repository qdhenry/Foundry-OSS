import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { AnalysisSidePanel } from "./AnalysisSidePanel";

const meta: Meta<typeof AnalysisSidePanel> = {
  title: "Documents/AnalysisSidePanel",
  component: AnalysisSidePanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    documentId: { control: "text" },
    isOpen: { control: "boolean" },
    onClose: { action: "onClose" },
  },
};

export default meta;
type Story = StoryObj<typeof AnalysisSidePanel>;

export const Default: Story = {
  args: {
    documentId: "doc-001",
    isOpen: true,
    onClose: fn(),
  },
};

export const Closed: Story = {
  args: {
    documentId: "doc-001",
    isOpen: false,
    onClose: fn(),
  },
};

export const NoDocumentId: Story = {
  args: {
    documentId: null,
    isOpen: true,
    onClose: fn(),
  },
};

export const CloseViaButton: Story = {
  args: {
    documentId: "doc-001",
    isOpen: true,
    onClose: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const closeBtn = canvas.getByRole("button", { name: /close panel/i });
    await userEvent.click(closeBtn);
  },
};

export const CloseViaEscape: Story = {
  args: {
    documentId: "doc-001",
    isOpen: true,
    onClose: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole("dialog");
    await userEvent.click(dialog);
    await userEvent.keyboard("{Escape}");
  },
};

export const Mobile: Story = {
  args: {
    documentId: "doc-001",
    isOpen: true,
    onClose: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    documentId: "doc-001",
    isOpen: true,
    onClose: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
