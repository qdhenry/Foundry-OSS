import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "@storybook/test";
import { RiskMatrix } from "./RiskMatrix";

const meta = {
  title: "Risks/RiskMatrix",
  component: RiskMatrix,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    severity: "high",
    probability: "likely",
  },
} satisfies Meta<typeof RiskMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    severity: "high",
    probability: "likely",
  },
};

// ─── Critical severity combinations ───────────────────────────────────────────

export const CriticalVeryLikely: Story = {
  name: "Critical / Very Likely",
  args: {
    severity: "critical",
    probability: "very_likely",
  },
};

export const CriticalLikely: Story = {
  name: "Critical / Likely",
  args: {
    severity: "critical",
    probability: "likely",
  },
};

export const CriticalPossible: Story = {
  name: "Critical / Possible",
  args: {
    severity: "critical",
    probability: "possible",
  },
};

export const CriticalUnlikely: Story = {
  name: "Critical / Unlikely",
  args: {
    severity: "critical",
    probability: "unlikely",
  },
};

// ─── High severity combinations ───────────────────────────────────────────────

export const HighVeryLikely: Story = {
  name: "High / Very Likely",
  args: {
    severity: "high",
    probability: "very_likely",
  },
};

export const HighPossible: Story = {
  name: "High / Possible",
  args: {
    severity: "high",
    probability: "possible",
  },
};

export const HighUnlikely: Story = {
  name: "High / Unlikely",
  args: {
    severity: "high",
    probability: "unlikely",
  },
};

// ─── Medium severity combinations ─────────────────────────────────────────────

export const MediumVeryLikely: Story = {
  name: "Medium / Very Likely",
  args: {
    severity: "medium",
    probability: "very_likely",
  },
};

export const MediumLikely: Story = {
  name: "Medium / Likely",
  args: {
    severity: "medium",
    probability: "likely",
  },
};

export const MediumPossible: Story = {
  name: "Medium / Possible",
  args: {
    severity: "medium",
    probability: "possible",
  },
};

export const MediumUnlikely: Story = {
  name: "Medium / Unlikely",
  args: {
    severity: "medium",
    probability: "unlikely",
  },
};

// ─── Low severity combinations ────────────────────────────────────────────────

export const LowVeryLikely: Story = {
  name: "Low / Very Likely",
  args: {
    severity: "low",
    probability: "very_likely",
  },
};

export const LowLikely: Story = {
  name: "Low / Likely",
  args: {
    severity: "low",
    probability: "likely",
  },
};

export const LowPossible: Story = {
  name: "Low / Possible",
  args: {
    severity: "low",
    probability: "possible",
  },
};

export const LowUnlikely: Story = {
  name: "Low / Unlikely (minimum risk)",
  args: {
    severity: "low",
    probability: "unlikely",
  },
};

// ─── Corner cases: extremes of the matrix ─────────────────────────────────────

export const MaximumRisk: Story = {
  name: "Maximum Risk (Critical / Very Likely)",
  args: {
    severity: "critical",
    probability: "very_likely",
  },
};

export const MinimumRisk: Story = {
  name: "Minimum Risk (Low / Unlikely)",
  args: {
    severity: "low",
    probability: "unlikely",
  },
};

// ─── Mobile viewport ─────────────────────────────────────────────────────────

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    severity: "critical",
    probability: "likely",
  },
};

// ─── Tablet viewport ──────────────────────────────────────────────────────────

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  args: {
    severity: "high",
    probability: "possible",
  },
};

// ─── Interactive: active cell is rendered with a dot indicator ───────────────

export const ActiveCellHasDot: Story = {
  args: {
    severity: "critical",
    probability: "very_likely",
  },
  play: async ({ canvasElement }) => {
    const _canvas = within(canvasElement);

    // The active cell renders an SVG circle dot — verify it exists
    const svgDot = canvasElement.querySelector("svg circle");
    await expect(svgDot).not.toBeNull();
  },
};

// ─── Interactive: heading label present ───────────────────────────────────────

export const HeadingPresent: Story = {
  args: {
    severity: "medium",
    probability: "possible",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByText("Risk Matrix");
    await expect(heading).toBeVisible();
  },
};

// ─── Interactive: axis labels present ────────────────────────────────────────

export const AxisLabelsPresent: Story = {
  args: {
    severity: "high",
    probability: "likely",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Column headers
    await expect(canvas.getByText("Critical")).toBeVisible();
    await expect(canvas.getByText("High")).toBeVisible();
    await expect(canvas.getByText("Medium")).toBeVisible();
    await expect(canvas.getByText("Low")).toBeVisible();

    // Row headers
    await expect(canvas.getByText("Very Likely")).toBeVisible();
    await expect(canvas.getByText("Likely")).toBeVisible();
    await expect(canvas.getByText("Possible")).toBeVisible();
    await expect(canvas.getByText("Unlikely")).toBeVisible();

    // Severity axis label
    await expect(canvas.getByText(/Severity/)).toBeVisible();
  },
};
