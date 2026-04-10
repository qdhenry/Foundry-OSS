import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgramWizard } from "./ProgramWizard";

const meta: Meta<typeof ProgramWizard> = {
  title: "Programs/ProgramWizard",
  component: ProgramWizard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    convex: {
      "programs.get": undefined,
      "documentAnalysis.getBatchProgress": [],
      "documentAnalysis.getActivityLogs": [],
      "discoveryFindings.listByProgram": [],
      "sourceControl.installations.listByOrg": [],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProgramWizard>;

export const Step1Basics: Story = {
  name: "Step 1 — Program Basics",
  args: {
    resumeProgramId: undefined,
  },
};

export const ResumeFromUpload: Story = {
  name: "Resume — Upload Step (setupStatus: wizard)",
  args: {
    resumeProgramId: "program_resume_001",
  },
  parameters: {
    convex: {
      "programs.get": {
        _id: "program_resume_001",
        name: "AcmeCorp B2B Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        setupStatus: "wizard",
        description: "Full Magento to Salesforce B2B migration.",
      },
      "documentAnalysis.getBatchProgress": [],
      "documentAnalysis.getActivityLogs": [],
      "discoveryFindings.listByProgram": [],
      "sourceControl.installations.listByOrg": [],
    },
  },
};

export const ResumeFromAnalysis: Story = {
  name: "Resume — Analysis Step (setupStatus: analyzing)",
  args: {
    resumeProgramId: "program_resume_002",
  },
  parameters: {
    convex: {
      "programs.get": {
        _id: "program_resume_002",
        name: "AcmeCorp B2B Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        setupStatus: "analyzing",
        description: "",
      },
      "documentAnalysis.getBatchProgress": [
        {
          analysisId: "analysis_001",
          documentName: "Requirements.pdf",
          status: "analyzing",
        },
      ],
      "documentAnalysis.getActivityLogs": [],
      "discoveryFindings.listByProgram": [],
      "sourceControl.installations.listByOrg": [],
    },
  },
};

export const ResumeFromReview: Story = {
  name: "Resume — Review Step (setupStatus: review)",
  args: {
    resumeProgramId: "program_resume_003",
  },
  parameters: {
    convex: {
      "programs.get": {
        _id: "program_resume_003",
        name: "AcmeCorp B2B Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        setupStatus: "review",
        description: "",
      },
      "documentAnalysis.getBatchProgress": [],
      "documentAnalysis.getActivityLogs": [],
      "discoveryFindings.listByProgram": [
        {
          _id: "f1",
          type: "requirement",
          status: "pending",
          confidence: "high",
          data: { title: "B2B Account Hierarchy Support" },
          sourceExcerpt: "The system must support B2B account hierarchies.",
          editedData: null,
          sourceAttribution: {},
        },
      ],
      "sourceControl.installations.listByOrg": [],
    },
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  args: {
    resumeProgramId: undefined,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "programs.get": undefined,
      "documentAnalysis.getBatchProgress": [],
      "documentAnalysis.getActivityLogs": [],
      "discoveryFindings.listByProgram": [],
      "sourceControl.installations.listByOrg": [],
    },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  args: {
    resumeProgramId: undefined,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "programs.get": undefined,
      "documentAnalysis.getBatchProgress": [],
      "documentAnalysis.getActivityLogs": [],
      "discoveryFindings.listByProgram": [],
      "sourceControl.installations.listByOrg": [],
    },
  },
};
