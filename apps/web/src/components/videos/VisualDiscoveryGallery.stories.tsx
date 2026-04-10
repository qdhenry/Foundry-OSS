import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VisualDiscoveryGallery } from "./VisualDiscoveryGallery";

const NOW = Date.now();

const mockAnalysisComplete = {
  _id: "analysis-001",
  _creationTime: NOW - 3600000,
  status: "complete",
  segmentOutputs: [
    {
      topic: "Project Kickoff and Scope Definition",
      summary:
        "Team aligned on migration scope from Magento to Salesforce B2B Commerce, covering 118 core requirements across 7 workstreams.",
      startMs: 0,
      endMs: 420000,
      keyframes: [
        {
          imageUrl: "https://placehold.co/640x360/1e293b/94a3b8?text=Keyframe+1",
          timestampMs: 30000,
          caption: "Project scope whiteboard session",
        },
        {
          imageUrl: "https://placehold.co/640x360/1e293b/94a3b8?text=Keyframe+2",
          timestampMs: 180000,
          caption: "Workstream breakdown diagram",
        },
      ],
      findings: [
        {
          type: "requirement",
          data: { title: "Real-time Inventory Sync" },
          sourceExcerpt:
            "The system must support real-time inventory sync across all sales channels.",
          sourceTimestamp: 125000,
          confidence: "high",
        },
        {
          type: "decision",
          data: { title: "Phased Migration Approach" },
          sourceExcerpt:
            "Decided to use phased migration approach to minimize business disruption.",
          sourceTimestamp: 300000,
          confidence: "high",
        },
      ],
    },
    {
      topic: "Technical Risk Review",
      summary:
        "Engineering team reviewed major technical blockers including custom Magento extensions and third-party integrations.",
      startMs: 420000,
      endMs: 900000,
      keyframes: [
        {
          imageUrl: "https://placehold.co/640x360/1e293b/94a3b8?text=Keyframe+3",
          timestampMs: 540000,
          caption: "Extension compatibility matrix",
        },
      ],
      findings: [
        {
          type: "risk",
          data: { title: "Custom Extension Risk" },
          sourceExcerpt:
            "Current Magento customizations may not have direct equivalents in Salesforce B2B Commerce.",
          sourceTimestamp: 480000,
          confidence: "medium",
        },
        {
          type: "integration",
          data: { title: "ERP Integration" },
          sourceExcerpt: "We need to integrate with the existing ERP system for order fulfillment.",
          sourceTimestamp: 700000,
          confidence: "high",
        },
      ],
    },
  ],
};

const mockAnalysisIndexing = {
  _id: "analysis-002",
  _creationTime: NOW - 900000,
  status: "indexing",
  segmentOutputs: [],
};

const mockAnalysisFailed = {
  _id: "analysis-003",
  _creationTime: NOW - 7200000,
  status: "failed",
  failedStage: "analyzing",
  failedError:
    "Claude analysis timed out after 120s. The video may be too long or have insufficient audio content.",
  segmentOutputs: [],
};

const meta: Meta<typeof VisualDiscoveryGallery> = {
  title: "Videos/VisualDiscoveryGallery",
  component: VisualDiscoveryGallery,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    programId: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof VisualDiscoveryGallery>;

export const Default: Story = {
  args: {
    programId: "program-123",
    analyses: [mockAnalysisComplete],
  },
};

export const Loading: Story = {
  args: {
    programId: "program-123",
    analyses: undefined,
  },
};

export const Empty: Story = {
  args: {
    programId: "program-123",
    analyses: [],
  },
};

export const MultipleAnalyses: Story = {
  args: {
    programId: "program-123",
    analyses: [mockAnalysisComplete, mockAnalysisIndexing, mockAnalysisFailed],
  },
};

export const InProgress: Story = {
  args: {
    programId: "program-123",
    analyses: [mockAnalysisIndexing],
  },
};

export const Failed: Story = {
  args: {
    programId: "program-123",
    analyses: [mockAnalysisFailed],
  },
};

export const NoKeyframes: Story = {
  args: {
    programId: "program-123",
    analyses: [
      {
        ...mockAnalysisComplete,
        _id: "analysis-no-keyframes",
        segmentOutputs: [
          {
            topic: "Discussion Segment",
            summary: "Meeting discussion with no visual content captured.",
            startMs: 0,
            endMs: 300000,
            keyframes: [],
            findings: [],
          },
        ],
      },
    ],
  },
};

export const Mobile: Story = {
  args: {
    programId: "program-123",
    analyses: [mockAnalysisComplete],
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    programId: "program-123",
    analyses: [mockAnalysisComplete],
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
