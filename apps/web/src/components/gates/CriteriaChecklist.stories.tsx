import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { CriteriaChecklist } from "./CriteriaChecklist";

const meta: Meta<typeof CriteriaChecklist> = {
  title: "Gates/CriteriaChecklist",
  component: CriteriaChecklist,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    gateId: { control: "text" },
    isEditable: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof CriteriaChecklist>;

// ─── Shared mock criteria ─────────────────────────────────────────────────────

const criteriaAllPending = [
  {
    title: "All unit tests passing",
    description: "CI must report green on the main branch for the last 3 runs.",
    passed: false,
  },
  {
    title: "Security scan completed",
    description: "OWASP ZAP scan with no critical vulnerabilities.",
    passed: false,
  },
  {
    title: "Stakeholder sign-off received",
    passed: false,
  },
];

const criteriaPartiallyPassed = [
  {
    title: "All unit tests passing",
    description: "CI must report green on the main branch for the last 3 runs.",
    passed: true,
    evidence: "https://ci.example.com/builds/417",
  },
  {
    title: "Security scan completed",
    description: "OWASP ZAP scan with no critical vulnerabilities.",
    passed: true,
    evidence: "ZAP report attached in Confluence",
  },
  {
    title: "Stakeholder sign-off received",
    passed: false,
  },
  {
    title: "Performance benchmarks met",
    description: "p95 latency under 200ms on the staging environment.",
    passed: false,
  },
];

const criteriaAllPassed = [
  {
    title: "All unit tests passing",
    description: "CI must report green on the main branch for the last 3 runs.",
    passed: true,
    evidence: "https://ci.example.com/builds/417",
  },
  {
    title: "Security scan completed",
    description: "OWASP ZAP scan with no critical vulnerabilities.",
    passed: true,
    evidence: "ZAP report attached in Confluence",
  },
  {
    title: "Stakeholder sign-off received",
    passed: true,
    evidence: "Email from CTO on 2026-02-14",
  },
];

const criteriaWithEvidence = [
  {
    title: "Database migration tested",
    description: "Run migration scripts on staging and verify row counts.",
    passed: true,
    evidence: "Verified 2026-02-18 — row counts match",
  },
  {
    title: "API contract validated",
    description: "Pact consumer-driven tests all green.",
    passed: false,
    evidence: "In progress — waiting on consumer team",
  },
];

// ─── Stories ─────────────────────────────────────────────────────────────────

export const AllPending: Story = {
  args: {
    gateId: "gate_001",
    criteria: criteriaAllPending,
    isEditable: false,
  },
};

export const AllPendingEditable: Story = {
  args: {
    gateId: "gate_001",
    criteria: criteriaAllPending,
    isEditable: true,
  },
};

export const PartiallyPassed: Story = {
  args: {
    gateId: "gate_002",
    criteria: criteriaPartiallyPassed,
    isEditable: false,
  },
};

export const PartiallyPassedEditable: Story = {
  args: {
    gateId: "gate_002",
    criteria: criteriaPartiallyPassed,
    isEditable: true,
  },
};

export const AllPassed: Story = {
  args: {
    gateId: "gate_003",
    criteria: criteriaAllPassed,
    isEditable: false,
  },
};

export const AllPassedEditable: Story = {
  args: {
    gateId: "gate_003",
    criteria: criteriaAllPassed,
    isEditable: true,
  },
};

export const WithEvidenceReadOnly: Story = {
  name: "With Evidence (Read-Only)",
  args: {
    gateId: "gate_004",
    criteria: criteriaWithEvidence,
    isEditable: false,
  },
};

export const SingleCriterion: Story = {
  args: {
    gateId: "gate_005",
    criteria: [
      {
        title: "Go/No-Go decision recorded",
        passed: false,
      },
    ],
    isEditable: true,
  },
};

export const EmptyCriteria: Story = {
  args: {
    gateId: "gate_006",
    criteria: [],
    isEditable: false,
  },
};

// ─── Interactive: toggle a criterion ─────────────────────────────────────────

export const ToggleCriterion: Story = {
  name: "Interactive — Toggle Criterion",
  args: {
    gateId: "gate_007",
    criteria: [
      {
        title: "All unit tests passing",
        description: "CI must be green for the last 3 runs.",
        passed: false,
      },
      {
        title: "Security scan completed",
        passed: false,
      },
    ],
    isEditable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleButtons = await canvas.findAllByRole("button");
    // First button is the checkbox toggle for the first criterion
    await userEvent.click(toggleButtons[0]);
  },
};

export const TypeEvidenceLink: Story = {
  name: "Interactive — Type Evidence Link",
  args: {
    gateId: "gate_008",
    criteria: [
      {
        title: "Regression suite passing",
        description: "All regression scenarios green in staging.",
        passed: false,
      },
    ],
    isEditable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const evidenceInput = await canvas.findByPlaceholderText(/evidence link or note/i);
    await userEvent.click(evidenceInput);
    await userEvent.type(evidenceInput, "https://ci.example.com/regression/789");
    await expect(evidenceInput).toHaveValue("https://ci.example.com/regression/789");
  },
};

// ─── Responsive viewports ─────────────────────────────────────────────────────

export const Mobile: Story = {
  args: {
    gateId: "gate_009",
    criteria: criteriaPartiallyPassed,
    isEditable: true,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    gateId: "gate_010",
    criteria: criteriaAllPassed,
    isEditable: false,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
