import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import VideoAnalysisDetailPage from "./page";

const meta = {
  title: "Pages/Videos/Detail",
  component: VideoAnalysisDetailPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof VideoAnalysisDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    convexMockData: {
      "videoAnalysis:get": {
        _id: "va-1" as any,
        _creationTime: Date.now() - 86400000,
        orgId: "org_foundry_demo",
        programId: "prog-acme-demo" as any,
        fileName: "Discovery Call - AcmeCorp.mp4",
        status: "complete",
        durationMs: 354000,
        videoDurationMs: 2700000,
        totalTokensUsed: 45200,
        stageTimestamps: {
          uploadedAt: Date.now() - 86400000,
          indexingStartedAt: Date.now() - 86000000,
          analyzingStartedAt: Date.now() - 85000000,
          completedAt: Date.now() - 84600000,
        },
        failedStage: undefined,
        failedError: undefined,
      },
      "videoAnalysis:getActivityLogsByAnalysis": [
        {
          _id: "log-1" as any,
          _creationTime: Date.now() - 86400000,
          analysisId: "va-1" as any,
          stage: "uploading",
          message: "Video upload started",
          timestamp: Date.now() - 86400000,
        },
        {
          _id: "log-2" as any,
          _creationTime: Date.now() - 86000000,
          analysisId: "va-1" as any,
          stage: "indexing",
          message: "Extracting keyframes and transcript",
          timestamp: Date.now() - 86000000,
        },
        {
          _id: "log-3" as any,
          _creationTime: Date.now() - 85000000,
          analysisId: "va-1" as any,
          stage: "analyzing",
          message: "Running AI analysis on transcript segments",
          timestamp: Date.now() - 85000000,
        },
        {
          _id: "log-4" as any,
          _creationTime: Date.now() - 84600000,
          analysisId: "va-1" as any,
          stage: "complete",
          message: "Analysis complete. Found 12 findings.",
          timestamp: Date.now() - 84600000,
        },
      ],
      "videoAnalysis:getVideoFindingsByAnalysis": [
        {
          _id: "vf-1" as any,
          _creationTime: Date.now() - 84600000,
          analysisId: "va-1" as any,
          title: "Custom pricing tier requirement",
          category: "requirement",
          confidence: 0.92,
          timestampMs: 120000,
          description: "Client mentioned need for volume-based pricing tiers",
        },
        {
          _id: "vf-2" as any,
          _creationTime: Date.now() - 84600000,
          analysisId: "va-1" as any,
          title: "Legacy ERP integration concern",
          category: "risk",
          confidence: 0.85,
          timestampMs: 340000,
          description: "Discussed challenges with existing ERP data sync",
        },
      ],
    },
  },
};

export const Analyzing: Story = {
  parameters: {
    convexMockData: {
      "videoAnalysis:get": {
        _id: "va-2" as any,
        _creationTime: Date.now() - 3600000,
        orgId: "org_foundry_demo",
        programId: "prog-acme-demo" as any,
        fileName: "Sprint Review Week 3.mov",
        status: "analyzing",
        durationMs: null,
        videoDurationMs: 1800000,
        totalTokensUsed: 12000,
        stageTimestamps: {
          uploadedAt: Date.now() - 3600000,
          indexingStartedAt: Date.now() - 3200000,
          analyzingStartedAt: Date.now() - 2800000,
        },
        failedStage: undefined,
        failedError: undefined,
      },
      "videoAnalysis:getActivityLogsByAnalysis": [
        {
          _id: "log-1" as any,
          _creationTime: Date.now() - 3600000,
          analysisId: "va-2" as any,
          stage: "uploading",
          message: "Video upload started",
          timestamp: Date.now() - 3600000,
        },
        {
          _id: "log-2" as any,
          _creationTime: Date.now() - 3200000,
          analysisId: "va-2" as any,
          stage: "indexing",
          message: "Extracting keyframes and transcript",
          timestamp: Date.now() - 3200000,
        },
        {
          _id: "log-3" as any,
          _creationTime: Date.now() - 2800000,
          analysisId: "va-2" as any,
          stage: "analyzing",
          message: "Running AI analysis...",
          timestamp: Date.now() - 2800000,
        },
      ],
    },
  },
};

export const Mobile: Story = {
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: "mobile" },
  },
};
