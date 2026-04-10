import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { AnalysisStep } from "./AnalysisStep";

const meta: Meta<typeof AnalysisStep> = {
  title: "Programs/Wizard/AnalysisStep",
  component: AnalysisStep,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    convex: {
      // Mock the useQuery calls so Storybook renders without a live backend
      "documentAnalysis.getBatchProgress": [
        {
          analysisId: "analysis_001",
          documentName: "Acme_Requirements.pdf",
          status: "complete",
        },
        {
          analysisId: "analysis_002",
          documentName: "Architecture_Overview.docx",
          status: "analyzing",
        },
        {
          analysisId: "analysis_003",
          documentName: "Meeting_Notes_Kickoff.pdf",
          status: "queued",
        },
      ],
      "documentAnalysis.getActivityLogs": [],
    },
  },
  args: {
    programId: "program_demo_001",
    onNext: fn(),
    onBack: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AnalysisStep>;

export const InProgress: Story = {
  name: "Analysis In Progress",
};

export const AllComplete: Story = {
  name: "All Documents Complete",
  parameters: {
    convex: {
      "documentAnalysis.getBatchProgress": [
        {
          analysisId: "analysis_001",
          documentName: "Acme_Requirements.pdf",
          status: "complete",
        },
        {
          analysisId: "analysis_002",
          documentName: "Architecture_Overview.docx",
          status: "complete",
        },
        {
          analysisId: "analysis_003",
          documentName: "Meeting_Notes_Kickoff.pdf",
          status: "complete",
        },
      ],
      "documentAnalysis.getActivityLogs": [
        {
          _id: "log_001",
          _creationTime: Date.now() - 60000,
          analysisId: "analysis_001",
          step: "findings",
          message: "Extracted 42 requirements, 8 risks, 5 integrations",
          level: "success",
        },
      ],
    },
  },
};

export const SomeFailed: Story = {
  name: "Some Documents Failed",
  parameters: {
    convex: {
      "documentAnalysis.getBatchProgress": [
        {
          analysisId: "analysis_001",
          documentName: "Acme_Requirements.pdf",
          status: "complete",
        },
        {
          analysisId: "analysis_002",
          documentName: "Corrupted_File.pdf",
          status: "failed",
        },
      ],
      "documentAnalysis.getActivityLogs": [
        {
          _id: "log_002",
          _creationTime: Date.now() - 30000,
          analysisId: "analysis_002",
          step: "failed",
          message: "Failed to parse document: unsupported format",
          level: "error",
        },
      ],
    },
  },
};

export const AllFailed: Story = {
  name: "All Documents Failed",
  parameters: {
    convex: {
      "documentAnalysis.getBatchProgress": [
        {
          analysisId: "analysis_001",
          documentName: "Acme_Requirements.pdf",
          status: "failed",
        },
        {
          analysisId: "analysis_002",
          documentName: "Architecture_Overview.docx",
          status: "failed",
        },
      ],
      "documentAnalysis.getActivityLogs": [],
    },
  },
};

export const NoDocuments: Story = {
  name: "No Documents (Empty State)",
  parameters: {
    convex: {
      "documentAnalysis.getBatchProgress": [],
      "documentAnalysis.getActivityLogs": [],
    },
  },
};

export const ExpandActivityLog: Story = {
  name: "Activity Log Expanded",
  parameters: {
    convex: {
      "documentAnalysis.getBatchProgress": [
        {
          analysisId: "analysis_001",
          documentName: "Acme_Requirements.pdf",
          status: "complete",
        },
      ],
      "documentAnalysis.getActivityLogs": [
        {
          _id: "log_001",
          _creationTime: Date.now() - 120000,
          analysisId: "analysis_001",
          step: "uploading",
          message: "Uploading document to storage",
          level: "info",
        },
        {
          _id: "log_002",
          _creationTime: Date.now() - 90000,
          analysisId: "analysis_001",
          step: "extracting",
          message: "Extracting text content",
          level: "info",
        },
        {
          _id: "log_003",
          _creationTime: Date.now() - 60000,
          analysisId: "analysis_001",
          step: "findings",
          message: "Extracted 42 requirements, 8 risks",
          level: "success",
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleButton = canvas.getByText(/view activity log/i);
    await userEvent.click(toggleButton);
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "documentAnalysis.getBatchProgress": [
        {
          analysisId: "analysis_001",
          documentName: "Acme_Requirements.pdf",
          status: "analyzing",
        },
        {
          analysisId: "analysis_002",
          documentName: "Architecture_Overview.docx",
          status: "complete",
        },
      ],
      "documentAnalysis.getActivityLogs": [],
    },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "documentAnalysis.getBatchProgress": [
        {
          analysisId: "analysis_001",
          documentName: "Acme_Requirements.pdf",
          status: "analyzing",
        },
      ],
      "documentAnalysis.getActivityLogs": [],
    },
  },
};
