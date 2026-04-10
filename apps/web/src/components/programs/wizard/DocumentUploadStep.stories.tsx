import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { DocumentUploadStep } from "./DocumentUploadStep";

const meta: Meta<typeof DocumentUploadStep> = {
  title: "Programs/Wizard/DocumentUploadStep",
  component: DocumentUploadStep,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "program_demo_001",
    orgId: "org_demo_001",
    onNext: fn(),
    onBack: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DocumentUploadStep>;

export const Empty: Story = {
  name: "Empty — No Files Selected",
};

export const NoProgramId: Story = {
  name: "No Program ID (pre-creation)",
  args: {
    programId: null,
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
