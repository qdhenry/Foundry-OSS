import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { DocumentUploadZone } from "./DocumentUploadZone";

const mockPdfFile = new File(["mock pdf content"], "Acme-Requirements-v2.pdf", {
  type: "application/pdf",
});

const mockDocxFile = new File(["mock docx content"], "Sprint-Retrospective-Notes.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

const mockImageFile = new File(["mock image data"], "architecture-diagram.png", {
  type: "image/png",
});

const meta: Meta<typeof DocumentUploadZone> = {
  title: "Documents/DocumentUploadZone",
  component: DocumentUploadZone,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    onFileSelect: { action: "onFileSelect" },
    onClear: { action: "onClear" },
  },
};

export default meta;
type Story = StoryObj<typeof DocumentUploadZone>;

export const Default: Story = {
  args: {
    selectedFile: null,
    onFileSelect: fn(),
    onClear: fn(),
  },
};

export const WithPdfSelected: Story = {
  args: {
    selectedFile: mockPdfFile,
    onFileSelect: fn(),
    onClear: fn(),
  },
};

export const WithDocxSelected: Story = {
  args: {
    selectedFile: mockDocxFile,
    onFileSelect: fn(),
    onClear: fn(),
  },
};

export const WithImageSelected: Story = {
  args: {
    selectedFile: mockImageFile,
    onFileSelect: fn(),
    onClear: fn(),
  },
};

export const ClearSelectedFile: Story = {
  args: {
    selectedFile: mockPdfFile,
    onFileSelect: fn(),
    onClear: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Find and click the clear (X) button
    const buttons = canvas.getAllByRole("button");
    if (buttons.length > 0) {
      await userEvent.click(buttons[0]);
    }
  },
};

export const Mobile: Story = {
  args: {
    selectedFile: null,
    onFileSelect: fn(),
    onClear: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const MobileWithFile: Story = {
  args: {
    selectedFile: mockPdfFile,
    onFileSelect: fn(),
    onClear: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    selectedFile: null,
    onFileSelect: fn(),
    onClear: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
