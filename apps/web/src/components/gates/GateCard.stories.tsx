import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { GateCard } from "./GateCard";

const meta: Meta<typeof GateCard> = {
  title: "Gates/GateCard",
  component: GateCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    nextjs: {
      // Prevent actual navigation during stories
      navigation: {
        pathname: "/program_001/gates",
      },
    },
  },
  argTypes: {
    programId: { control: "text" },
    workstreamName: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof GateCard>;

// ─── Shared gate factories ────────────────────────────────────────────────────

function makeGate(
  overrides: Partial<{
    _id: string;
    name: string;
    gateType: "foundation" | "development" | "integration" | "release";
    status: "pending" | "passed" | "failed" | "overridden";
    criteria: Array<{ title: string; description?: string; passed: boolean; evidence?: string }>;
    workstreamId: string;
  }> = {},
) {
  return {
    _id: "gate_001",
    name: "Foundation Gate",
    gateType: "foundation" as const,
    status: "pending" as const,
    workstreamId: "ws_001",
    criteria: [
      { title: "Architecture approved", passed: false },
      { title: "Team onboarded", passed: false },
      { title: "Environments provisioned", passed: false },
    ],
    ...overrides,
  };
}

// ─── Gate type variants ───────────────────────────────────────────────────────

export const FoundationPending: Story = {
  name: "Foundation — Pending",
  args: {
    gate: makeGate({
      name: "Foundation Gate",
      gateType: "foundation",
      status: "pending",
      criteria: [
        { title: "Architecture approved", passed: true, evidence: "ADR-001" },
        { title: "Team onboarded", passed: false },
        { title: "Environments provisioned", passed: false },
      ],
    }),
    programId: "program_001",
    workstreamName: "Platform Migration",
  },
};

export const DevelopmentPassed: Story = {
  name: "Development — Passed",
  args: {
    gate: makeGate({
      _id: "gate_002",
      name: "Development Readiness Gate",
      gateType: "development",
      status: "passed",
      criteria: [
        { title: "All unit tests passing", passed: true, evidence: "CI build #412" },
        { title: "Code review complete", passed: true, evidence: "PR #88 merged" },
        { title: "Security scan clear", passed: true },
      ],
    }),
    programId: "program_001",
    workstreamName: "Core Commerce",
  },
};

export const IntegrationFailed: Story = {
  name: "Integration — Failed",
  args: {
    gate: makeGate({
      _id: "gate_003",
      name: "Integration Gate",
      gateType: "integration",
      status: "failed",
      criteria: [
        { title: "API contract tests green", passed: false },
        { title: "End-to-end smoke tests passing", passed: false },
        { title: "Performance benchmarks met", passed: true, evidence: "p95 = 180ms" },
      ],
    }),
    programId: "program_001",
    workstreamName: "Integrations",
  },
};

export const ReleaseOverridden: Story = {
  name: "Release — Overridden",
  args: {
    gate: makeGate({
      _id: "gate_004",
      name: "Release Gate",
      gateType: "release",
      status: "overridden",
      criteria: [
        { title: "Stakeholder sign-off", passed: true },
        { title: "Rollback plan documented", passed: true },
        { title: "Launch comms ready", passed: false },
      ],
    }),
    programId: "program_001",
    workstreamName: "Go-Live",
  },
};

// ─── Progress bar states ──────────────────────────────────────────────────────

export const NoCriteriaPassed: Story = {
  name: "Progress — 0% (No criteria passed)",
  args: {
    gate: makeGate({
      _id: "gate_005",
      name: "Empty Progress Gate",
      gateType: "development",
      status: "pending",
      criteria: [
        { title: "Criterion Alpha", passed: false },
        { title: "Criterion Beta", passed: false },
        { title: "Criterion Gamma", passed: false },
        { title: "Criterion Delta", passed: false },
      ],
    }),
    programId: "program_001",
  },
};

export const HalfCriteriaPassed: Story = {
  name: "Progress — 50%",
  args: {
    gate: makeGate({
      _id: "gate_006",
      name: "Half-Complete Gate",
      gateType: "integration",
      status: "pending",
      criteria: [
        { title: "Criterion Alpha", passed: true },
        { title: "Criterion Beta", passed: true },
        { title: "Criterion Gamma", passed: false },
        { title: "Criterion Delta", passed: false },
      ],
    }),
    programId: "program_001",
    workstreamName: "Data Migration",
  },
};

export const AllCriteriaPassed: Story = {
  name: "Progress — 100% (All criteria passed)",
  args: {
    gate: makeGate({
      _id: "gate_007",
      name: "Fully Complete Gate",
      gateType: "release",
      status: "passed",
      criteria: [
        { title: "Criterion Alpha", passed: true },
        { title: "Criterion Beta", passed: true },
        { title: "Criterion Gamma", passed: true },
      ],
    }),
    programId: "program_001",
    workstreamName: "Release Management",
  },
};

export const NoCriteria: Story = {
  name: "No Criteria Defined",
  args: {
    gate: makeGate({
      _id: "gate_008",
      name: "Unconfigured Gate",
      gateType: "foundation",
      status: "pending",
      criteria: [],
    }),
    programId: "program_001",
  },
};

// ─── Workstream label variants ────────────────────────────────────────────────

export const WithWorkstreamName: Story = {
  args: {
    gate: makeGate({
      _id: "gate_009",
      name: "QA Gate",
      gateType: "development",
      status: "pending",
    }),
    programId: "program_001",
    workstreamName: "Quality Assurance",
  },
};

export const WithoutWorkstreamName: Story = {
  args: {
    gate: makeGate({
      _id: "gate_010",
      name: "QA Gate",
      gateType: "development",
      status: "pending",
    }),
    programId: "program_001",
  },
};

// ─── Interactive: hover state ─────────────────────────────────────────────────

export const HoverState: Story = {
  name: "Interactive — Hover",
  args: {
    gate: makeGate({
      _id: "gate_011",
      name: "Foundation Gate",
      gateType: "foundation",
      status: "pending",
      criteria: [
        { title: "Architecture approved", passed: true },
        { title: "Team onboarded", passed: false },
      ],
    }),
    programId: "program_001",
    workstreamName: "Platform Migration",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByRole("link");
    await userEvent.hover(card);
  },
};

// ─── Grid layout (multiple cards) ────────────────────────────────────────────

export const CardGrid: Story = {
  name: "Card Grid (multiple gates)",
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <GateCard
        gate={makeGate({
          _id: "g1",
          name: "Foundation Gate",
          gateType: "foundation",
          status: "passed",
          criteria: [{ title: "ADR approved", passed: true }],
        })}
        programId="program_001"
        workstreamName="Platform Migration"
      />
      <GateCard
        gate={makeGate({
          _id: "g2",
          name: "Development Gate",
          gateType: "development",
          status: "pending",
          criteria: [
            { title: "Tests passing", passed: true },
            { title: "Code review done", passed: false },
          ],
        })}
        programId="program_001"
        workstreamName="Core Commerce"
      />
      <GateCard
        gate={makeGate({
          _id: "g3",
          name: "Integration Gate",
          gateType: "integration",
          status: "failed",
          criteria: [
            { title: "API tests green", passed: false },
            { title: "E2E tests passing", passed: false },
          ],
        })}
        programId="program_001"
        workstreamName="Integrations"
      />
      <GateCard
        gate={makeGate({
          _id: "g4",
          name: "Release Gate",
          gateType: "release",
          status: "overridden",
          criteria: [
            { title: "Stakeholder sign-off", passed: true },
            { title: "Rollback plan ready", passed: true },
            { title: "Launch comms ready", passed: false },
          ],
        })}
        programId="program_001"
        workstreamName="Go-Live"
      />
    </div>
  ),
};

// ─── Responsive viewports ─────────────────────────────────────────────────────

export const Mobile: Story = {
  args: {
    gate: makeGate({
      _id: "gate_012",
      name: "Development Gate",
      gateType: "development",
      status: "pending",
      criteria: [
        { title: "Unit tests passing", passed: true },
        { title: "Security scan clear", passed: false },
      ],
    }),
    programId: "program_001",
    workstreamName: "Core Commerce",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    gate: makeGate({
      _id: "gate_013",
      name: "Release Gate",
      gateType: "release",
      status: "passed",
      criteria: [
        { title: "Stakeholder sign-off", passed: true },
        { title: "Rollback plan documented", passed: true },
        { title: "Launch comms ready", passed: true },
      ],
    }),
    programId: "program_001",
    workstreamName: "Go-Live",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
