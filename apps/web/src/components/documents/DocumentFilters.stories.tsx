import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { DocumentFilters } from "./DocumentFilters";

const meta: Meta<typeof DocumentFilters> = {
  title: "Documents/DocumentFilters",
  component: DocumentFilters,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    selectedCategory: {
      control: "select",
      options: [
        undefined,
        "architecture",
        "requirements",
        "testing",
        "deployment",
        "meeting_notes",
        "other",
      ],
    },
    onCategoryChange: { action: "onCategoryChange" },
  },
};

export default meta;
type Story = StoryObj<typeof DocumentFilters>;

export const Default: Story = {
  args: {
    selectedCategory: undefined,
    onCategoryChange: fn(),
  },
};

export const ArchitectureSelected: Story = {
  args: {
    selectedCategory: "architecture",
    onCategoryChange: fn(),
  },
};

export const RequirementsSelected: Story = {
  args: {
    selectedCategory: "requirements",
    onCategoryChange: fn(),
  },
};

export const MeetingNotesSelected: Story = {
  args: {
    selectedCategory: "meeting_notes",
    onCategoryChange: fn(),
  },
};

export const TestingSelected: Story = {
  args: {
    selectedCategory: "testing",
    onCategoryChange: fn(),
  },
};

export const SelectCategory: Story = {
  args: {
    selectedCategory: undefined,
    onCategoryChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("combobox");
    await userEvent.selectOptions(select, "requirements");
  },
};

export const ClearFilter: Story = {
  args: {
    selectedCategory: "architecture",
    onCategoryChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clearBtn = canvas.getByRole("button", { name: /clear filter/i });
    await userEvent.click(clearBtn);
  },
};

export const Mobile: Story = {
  args: {
    selectedCategory: "requirements",
    onCategoryChange: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    selectedCategory: undefined,
    onCategoryChange: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
