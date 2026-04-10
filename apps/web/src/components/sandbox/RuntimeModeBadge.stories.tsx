import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RuntimeModeBadge } from "./RuntimeModeBadge";

const meta = {
  title: "Sandbox/RuntimeModeBadge",
  component: RuntimeModeBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    mode: {
      description: "The current runtime mode of the sandbox",
      control: { type: "select" },
      options: ["idle", "executing", "interactive", "hibernating", "custom_mode", null, undefined],
    },
    className: {
      description: "Additional CSS classes",
      control: { type: "text" },
    },
  },
} satisfies Meta<typeof RuntimeModeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Idle",
  args: {
    mode: "idle",
  },
};

export const Executing: Story = {
  args: {
    mode: "executing",
  },
};

export const Interactive: Story = {
  args: {
    mode: "interactive",
  },
};

export const Hibernating: Story = {
  args: {
    mode: "hibernating",
  },
};

// Custom / unknown mode — label is derived from the mode string
export const CustomMode: Story = {
  name: "Custom / Unknown Mode",
  args: {
    mode: "custom_mode",
  },
};

// Null / undefined — renders nothing
export const NullMode: Story = {
  name: "Null (renders nothing)",
  args: {
    mode: null,
  },
};

// All variants in a grid for comparison
export const AllVariants: Story = {
  name: "All Variants",
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      <RuntimeModeBadge mode="idle" />
      <RuntimeModeBadge mode="executing" />
      <RuntimeModeBadge mode="interactive" />
      <RuntimeModeBadge mode="hibernating" />
      <RuntimeModeBadge mode="custom_mode" />
    </div>
  ),
};

export const Mobile: Story = {
  args: {
    mode: "executing",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  args: {
    mode: "interactive",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
