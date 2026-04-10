import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineStageDiscovery } from "./PipelineStageDiscovery";

const meta = {
  title: "Pipeline/Stages/PipelineStageDiscovery",
  component: PipelineStageDiscovery,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageDiscovery>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseRequirement = {
  _id: "req_001",
  refId: "BM-001",
  title: "Customer Account Management — self-service portal for B2B buyers",
  description:
    "Buyers need to manage their own account details, order history, and payment methods without contacting support.",
};

const commonProps = {
  requirement: baseRequirement,
  programId: "prog_123" as any,
  workstreamId: "ws_001" as any,
  tasks: [],
};

const mockFinding = {
  _id: "finding_001",
  status: "imported",
  type: "requirement",
  confidence: "high",
  sourceExcerpt:
    "Customers require self-service account management including profile updates and order visibility.",
  documentName: "AcmeCorp RFP v2.pdf",
  data: {
    description:
      "The system must allow B2B buyers to manage their account profile, view order history, and update payment methods.",
  },
};

export const WithFinding: Story = {
  args: {
    ...commonProps,
    finding: mockFinding,
  },
};

export const WithMediumConfidenceFinding: Story = {
  args: {
    ...commonProps,
    finding: {
      ...mockFinding,
      confidence: "medium",
      status: "pending",
    },
  },
};

export const WithLowConfidenceFinding: Story = {
  args: {
    ...commonProps,
    finding: {
      ...mockFinding,
      confidence: "low",
      status: "pending",
      sourceExcerpt: undefined,
    },
  },
};

export const FindingWithoutSourceExcerpt: Story = {
  args: {
    ...commonProps,
    finding: {
      ...mockFinding,
      sourceExcerpt: undefined,
      documentName: undefined,
    },
  },
};

export const NoFinding: Story = {
  args: {
    ...commonProps,
    finding: null,
  },
};

export const NoFindingUndefined: Story = {
  args: {
    ...commonProps,
    finding: undefined,
  },
};

export const Mobile: Story = {
  args: {
    ...commonProps,
    finding: mockFinding,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    ...commonProps,
    finding: mockFinding,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
