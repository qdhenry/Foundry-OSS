import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { RiskFilters } from "./RiskFilters";

const meta = {
  title: "Risks/RiskFilters",
  component: RiskFilters,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    severity: "",
    status: "",
    onSeverityChange: fn(),
    onStatusChange: fn(),
  },
} satisfies Meta<typeof RiskFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Default: no filters active ───────────────────────────────────────────────

export const Default: Story = {
  args: {
    severity: "",
    status: "",
  },
};

// ─── Severity filter active ───────────────────────────────────────────────────

export const SeverityCritical: Story = {
  args: {
    severity: "critical",
    status: "",
  },
};

export const SeverityHigh: Story = {
  args: {
    severity: "high",
    status: "",
  },
};

export const SeverityMedium: Story = {
  args: {
    severity: "medium",
    status: "",
  },
};

export const SeverityLow: Story = {
  args: {
    severity: "low",
    status: "",
  },
};

// ─── Status filter active ─────────────────────────────────────────────────────

export const StatusOpen: Story = {
  args: {
    severity: "",
    status: "open",
  },
};

export const StatusMitigating: Story = {
  args: {
    severity: "",
    status: "mitigating",
  },
};

export const StatusResolved: Story = {
  args: {
    severity: "",
    status: "resolved",
  },
};

export const StatusAccepted: Story = {
  args: {
    severity: "",
    status: "accepted",
  },
};

// ─── Both filters active (shows "Clear filters" button) ───────────────────────

export const BothFiltersActive: Story = {
  args: {
    severity: "critical",
    status: "open",
  },
};

export const HighMitigating: Story = {
  args: {
    severity: "high",
    status: "mitigating",
  },
};

export const LowResolved: Story = {
  args: {
    severity: "low",
    status: "resolved",
  },
};

// ─── Mobile viewport ─────────────────────────────────────────────────────────

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    severity: "critical",
    status: "open",
  },
};

// ─── Tablet viewport ──────────────────────────────────────────────────────────

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  args: {
    severity: "high",
    status: "mitigating",
  },
};

// ─── Interactive: change severity filter ──────────────────────────────────────

export const InteractiveChangeSeverity: Story = {
  args: {
    severity: "",
    status: "",
    onSeverityChange: fn(),
    onStatusChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const severitySelect = canvas.getByDisplayValue("All Severities");

    await userEvent.selectOptions(severitySelect, "critical");
    await expect(args.onSeverityChange).toHaveBeenCalledWith("critical");
  },
};

// ─── Interactive: change status filter ───────────────────────────────────────

export const InteractiveChangeStatus: Story = {
  args: {
    severity: "",
    status: "",
    onSeverityChange: fn(),
    onStatusChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const statusSelect = canvas.getByDisplayValue("All Statuses");

    await userEvent.selectOptions(statusSelect, "mitigating");
    await expect(args.onStatusChange).toHaveBeenCalledWith("mitigating");
  },
};

// ─── Interactive: clear filters ───────────────────────────────────────────────

export const InteractiveClearFilters: Story = {
  args: {
    severity: "high",
    status: "open",
    onSeverityChange: fn(),
    onStatusChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const clearButton = canvas.getByRole("button", { name: /clear filters/i });

    await expect(clearButton).toBeVisible();
    await userEvent.click(clearButton);

    await expect(args.onSeverityChange).toHaveBeenCalledWith("");
    await expect(args.onStatusChange).toHaveBeenCalledWith("");
  },
};

// ─── Interactive: clear button absent when no filters ────────────────────────

export const NoClearButtonWhenNoFilters: Story = {
  args: {
    severity: "",
    status: "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clearButton = canvas.queryByRole("button", { name: /clear filters/i });
    await expect(clearButton).toBeNull();
  },
};
