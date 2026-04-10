import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AnalysisCompletionCard } from "./AnalysisCompletionCard";

const NOW = Date.now();

const mockFindings = [
  {
    _id: "finding-1",
    type: "requirement",
    status: "pending",
    sourceTimestamp: 125000,
    sourceTimestampEnd: 140000,
    sourceExcerpt: "The system must support real-time inventory sync across all sales channels.",
    confidence: "high",
    data: { title: "Real-time Inventory Sync" },
    segmentIndex: 0,
  },
  {
    _id: "finding-2",
    type: "risk",
    status: "pending",
    sourceTimestamp: 300000,
    sourceExcerpt:
      "Current Magento customizations may not have direct equivalents in Salesforce B2B Commerce.",
    confidence: "medium",
    data: { title: "Custom Extension Risk" },
    segmentIndex: 1,
  },
  {
    _id: "finding-3",
    type: "integration",
    status: "pending",
    sourceTimestamp: 480000,
    sourceExcerpt: "We need to integrate with the existing ERP system for order fulfillment.",
    confidence: "high",
    data: { title: "ERP Integration" },
    segmentIndex: 2,
  },
  {
    _id: "finding-4",
    type: "decision",
    status: "pending",
    sourceTimestamp: 600000,
    sourceExcerpt: "Decided to use phased migration approach to minimize business disruption.",
    confidence: "high",
    data: { title: "Phased Migration Approach" },
    segmentIndex: 2,
  },
  {
    _id: "finding-5",
    type: "action_item",
    status: "pending",
    sourceTimestamp: 720000,
    sourceExcerpt: "Team to provide a full list of third-party plugins by end of week.",
    confidence: "medium",
    data: { title: "Plugin Inventory Action" },
    segmentIndex: 3,
  },
  {
    _id: "finding-6",
    type: "requirement",
    status: "pending",
    sourceTimestamp: 850000,
    sourceExcerpt: "B2B pricing tiers must be maintained during migration.",
    confidence: "high",
    data: { title: "B2B Pricing Tiers" },
    segmentIndex: 3,
  },
];

const mockAnalysisComplete = {
  durationMs: 187000,
  totalTokensUsed: 142500,
  videoDurationMs: 3720000,
  stageTimestamps: { completedAt: NOW - 600000 },
};

const mockAnalysisMinimal = {
  stageTimestamps: { completedAt: NOW - 3600000 },
};

const meta: Meta<typeof AnalysisCompletionCard> = {
  title: "Videos/AnalysisCompletionCard",
  component: AnalysisCompletionCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    programId: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof AnalysisCompletionCard>;

export const Default: Story = {
  args: {
    programId: "program-123",
    videoFindings: mockFindings,
    analysis: mockAnalysisComplete,
  },
};

export const Loading: Story = {
  args: {
    programId: "program-123",
    videoFindings: undefined,
    analysis: mockAnalysisComplete,
  },
};

export const NoFindings: Story = {
  args: {
    programId: "program-123",
    videoFindings: [],
    analysis: mockAnalysisComplete,
  },
};

export const MinimalAnalysisData: Story = {
  args: {
    programId: "program-123",
    videoFindings: mockFindings.slice(0, 2),
    analysis: mockAnalysisMinimal,
  },
};

export const ManyFindings: Story = {
  args: {
    programId: "program-123",
    videoFindings: [...mockFindings, ...mockFindings.map((f) => ({ ...f, _id: `${f._id}-dup` }))],
    analysis: mockAnalysisComplete,
  },
};

export const Mobile: Story = {
  args: {
    programId: "program-123",
    videoFindings: mockFindings,
    analysis: mockAnalysisComplete,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    programId: "program-123",
    videoFindings: mockFindings,
    analysis: mockAnalysisComplete,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
