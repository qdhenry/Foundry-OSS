import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { ExecutionOutput } from "./ExecutionOutput";

const SAMPLE_OUTPUT = `## Gap Analysis: AcmeCorp — Magento → Salesforce B2B Commerce

### Executive Summary
Analysis of 118 requirements against target platform capabilities reveals 3 critical gaps and 7 medium-priority coverage risks.

### Critical Gaps
1. **Customer Hierarchy (B2B Account Tree)**
   - Magento supports flat account structure; Salesforce B2B Commerce requires explicit parent/child account relationships
   - Recommendation: Pre-migration data transformation required to map customer groups → account hierarchy

2. **Tier-Based Pricing (Contract Pricing)**
   - Current: Magento catalog price rules per customer group
   - Target: Salesforce Commerce requires Price Book + Entitlement Policy
   - Risk: ~2,400 price records require transformation

3. **Procurement Order Integration**
   - No native PO approval workflow in Salesforce B2B Commerce out-of-the-box
   - Custom Flow or OMS integration required

### Medium Risks
- Product attribute mapping: 14 custom attributes not available in standard Commerce catalog
- Account self-service portal: custom Aura/LWC component required
- Reorder functionality: requires custom Order History API

### Recommended Next Steps
- Engage Salesforce Commerce Cloud architect for account hierarchy design session
- Schedule pricing data transformation proof-of-concept
- Add 3 new requirements to backlog for PO workflow`;

const meta: Meta<typeof ExecutionOutput> = {
  title: "AI/ExecutionOutput",
  component: ExecutionOutput,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    reviewStatus: {
      control: "select",
      options: ["pending", "accepted", "revised", "rejected"],
    },
    tokensUsed: { control: "number" },
    durationMs: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof ExecutionOutput>;

export const PendingReview: Story = {
  name: "Pending Review",
  args: {
    executionId: "exec_001",
    output: SAMPLE_OUTPUT,
    skillName: "Requirements Analyzer",
    tokensUsed: 4821,
    durationMs: 12340,
    reviewStatus: "pending",
  },
};

export const Accepted: Story = {
  args: {
    executionId: "exec_002",
    output: SAMPLE_OUTPUT,
    skillName: "Code Quality Auditor",
    tokensUsed: 7230,
    durationMs: 18900,
    reviewStatus: "accepted",
  },
};

export const Revised: Story = {
  args: {
    executionId: "exec_003",
    output: SAMPLE_OUTPUT,
    skillName: "Migration Planner",
    tokensUsed: 9104,
    durationMs: 24500,
    reviewStatus: "revised",
  },
};

export const Rejected: Story = {
  args: {
    executionId: "exec_004",
    output: SAMPLE_OUTPUT,
    skillName: "Risk Evaluator",
    tokensUsed: 3200,
    durationMs: 8100,
    reviewStatus: "rejected",
  },
};

export const NoSkillName: Story = {
  name: "No Skill Name",
  args: {
    executionId: "exec_005",
    output: SAMPLE_OUTPUT,
    skillName: null,
    tokensUsed: 2100,
    durationMs: 5400,
    reviewStatus: "pending",
  },
};

export const MinimalMetadata: Story = {
  name: "Minimal Metadata (no tokens/duration)",
  args: {
    executionId: "exec_006",
    output: "The agent completed the task with no additional metadata recorded.",
    skillName: null,
    tokensUsed: null,
    durationMs: null,
    reviewStatus: "pending",
  },
};

export const LongOutput: Story = {
  name: "Long Output (scrollable)",
  args: {
    executionId: "exec_007",
    output: Array(20).fill(SAMPLE_OUTPUT).join("\n\n---\n\n"),
    skillName: "Deep Analysis Skill",
    tokensUsed: 98000,
    durationMs: 120000,
    reviewStatus: "pending",
  },
};

export const ClickAccept: Story = {
  name: "Interaction — Click Accept",
  args: {
    executionId: "exec_008",
    output: SAMPLE_OUTPUT,
    skillName: "Requirements Analyzer",
    tokensUsed: 4821,
    durationMs: 12340,
    reviewStatus: "pending",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const acceptButton = canvas.getByRole("button", { name: /accept/i });
    await userEvent.click(acceptButton);
  },
};

export const ClickReject: Story = {
  name: "Interaction — Click Reject",
  args: {
    executionId: "exec_009",
    output: SAMPLE_OUTPUT,
    skillName: "Requirements Analyzer",
    tokensUsed: 4821,
    durationMs: 12340,
    reviewStatus: "pending",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rejectButton = canvas.getByRole("button", { name: /reject/i });
    await userEvent.click(rejectButton);
  },
};

export const Mobile: Story = {
  args: {
    executionId: "exec_mobile",
    output: SAMPLE_OUTPUT,
    skillName: "Requirements Analyzer",
    tokensUsed: 4821,
    durationMs: 12340,
    reviewStatus: "pending",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    executionId: "exec_tablet",
    output: SAMPLE_OUTPUT,
    skillName: "Requirements Analyzer",
    tokensUsed: 4821,
    durationMs: 12340,
    reviewStatus: "pending",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
