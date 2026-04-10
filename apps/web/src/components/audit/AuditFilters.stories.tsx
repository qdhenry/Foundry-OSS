import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AuditFilters } from "./AuditFilters";

const meta: Meta<typeof AuditFilters> = {
  title: "Audit/AuditFilters",
  component: AuditFilters,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    entityType: {
      description: "Currently selected entity type filter value (empty string = all)",
      control: "select",
      options: [
        "",
        "program",
        "requirement",
        "risk",
        "task",
        "skill",
        "gate",
        "sprint",
        "integration",
        "document",
      ],
    },
    limit: {
      description: "Number of audit entries to display",
      control: "select",
      options: [25, 50, 100, 200],
    },
    onEntityTypeChange: {
      description: "Callback fired when entity type filter changes",
      action: "entityTypeChanged",
    },
    onLimitChange: {
      description: "Callback fired when entry limit changes",
      action: "limitChanged",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuditFilters>;

export const Default: Story = {
  args: {
    entityType: "",
    limit: 50,
  },
};

export const NoFiltersActive: Story = {
  name: "No Filters Active (clear button hidden)",
  args: {
    entityType: "",
    limit: 50,
  },
};

export const EntityTypeFiltered: Story = {
  name: "Entity Type Filter: Requirement",
  args: {
    entityType: "requirement",
    limit: 50,
  },
};

export const FilteredByProgram: Story = {
  name: "Entity Type Filter: Program",
  args: {
    entityType: "program",
    limit: 50,
  },
};

export const FilteredByRisk: Story = {
  name: "Entity Type Filter: Risk",
  args: {
    entityType: "risk",
    limit: 50,
  },
};

export const FilteredByTask: Story = {
  name: "Entity Type Filter: Task",
  args: {
    entityType: "task",
    limit: 50,
  },
};

export const FilteredBySkill: Story = {
  name: "Entity Type Filter: Skill",
  args: {
    entityType: "skill",
    limit: 50,
  },
};

export const LimitChanged: Story = {
  name: "Limit Changed (shows clear button)",
  args: {
    entityType: "",
    limit: 100,
  },
};

export const BothFiltersActive: Story = {
  name: "Both Filters Active",
  args: {
    entityType: "task",
    limit: 200,
  },
};

export const HighLimit: Story = {
  name: "High Limit (200 entries)",
  args: {
    entityType: "",
    limit: 200,
  },
};

export const LowLimit: Story = {
  name: "Low Limit (25 entries)",
  args: {
    entityType: "requirement",
    limit: 25,
  },
};

export const InteractiveEntityTypeChange: Story = {
  name: "Interactive: Change Entity Type",
  args: {
    entityType: "",
    limit: 50,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const selects = canvas.getAllByRole("combobox");
    const entitySelect = selects[0];

    await userEvent.selectOptions(entitySelect, "requirement");
  },
};

export const InteractiveClearFilters: Story = {
  name: "Interactive: Clear Filters",
  args: {
    entityType: "risk",
    limit: 100,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clearButton = canvas.getByRole("button", { name: /clear filters/i });
    await expect(clearButton).toBeVisible();
    await userEvent.click(clearButton);
  },
};

export const Mobile: Story = {
  args: {
    entityType: "requirement",
    limit: 50,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const Tablet: Story = {
  args: {
    entityType: "",
    limit: 100,
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
