import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { PipelineDocumentDrawer } from "./PipelineDocumentDrawer";

const meta = {
  title: "Pipeline/PipelineDocumentDrawer",
  component: PipelineDocumentDrawer,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof PipelineDocumentDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockArgs = {
  programId: "prog_123" as any,
  isOpen: true,
  onClose: fn(),
};

export const Open: Story = {
  args: mockArgs,
};

export const Closed: Story = {
  args: {
    ...mockArgs,
    isOpen: false,
  },
};

export const Mobile: Story = {
  args: mockArgs,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: mockArgs,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const CloseOnBackdropClick: Story = {
  args: mockArgs,
  play: async ({ canvasElement }) => {
    const _canvas = within(canvasElement);
    // Click the close button in the drawer header
    const closeButton = canvasElement.querySelector(
      "button[class*='rounded-lg']",
    ) as HTMLButtonElement | null;
    if (closeButton) {
      await userEvent.click(closeButton);
    }
  },
};
