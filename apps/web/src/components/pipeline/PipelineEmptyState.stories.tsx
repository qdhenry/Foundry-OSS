import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { PipelineEmptyState } from "./PipelineEmptyState";

const meta = {
  title: "Pipeline/PipelineEmptyState",
  component: PipelineEmptyState,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockArgs = {
  programId: "prog_acme_corp",
  onCreateRequirement: fn(),
};

export const Default: Story = {
  args: mockArgs,
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

export const CreateRequirementClick: Story = {
  args: mockArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const createButton = canvas.getByRole("button", {
      name: /create a requirement manually/i,
    });
    await userEvent.click(createButton);
  },
};
