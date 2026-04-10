import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { DocumentCard } from "./DocumentCard";

const NOW = Date.now();

const baseDocument = {
  _id: "doc-001",
  _creationTime: NOW - 86400000,
  fileName: "Acme-Requirements-v2.pdf",
  fileType: "application/pdf",
  fileSize: 2_450_000,
  category: "requirements",
  description: "Full requirements specification for the Salesforce B2B Commerce migration.",
  uploaderName: "Alex Morgan",
  downloadUrl: "https://example.com/files/requirements.pdf",
  analysisStatus: "complete" as const,
};

const meta: Meta<typeof DocumentCard> = {
  title: "Documents/DocumentCard",
  component: DocumentCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-border-default text-left">
              <th className="px-4 py-2 text-xs font-medium text-text-secondary">Name</th>
              <th className="px-4 py-2 text-xs font-medium text-text-secondary">Category</th>
              <th className="px-4 py-2 text-xs font-medium text-text-secondary">Type</th>
              <th className="px-4 py-2 text-xs font-medium text-text-secondary">Size</th>
              <th className="px-4 py-2 text-xs font-medium text-text-secondary">Uploaded By</th>
              <th className="px-4 py-2 text-xs font-medium text-text-secondary">Date</th>
              <th className="px-4 py-2 text-xs font-medium text-text-secondary">Analysis</th>
              <th className="px-4 py-2 text-xs font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            <Story />
          </tbody>
        </table>
      </div>
    ),
  ],
  argTypes: {
    onDelete: { action: "onDelete" },
    onViewAnalysis: { action: "onViewAnalysis" },
  },
};

export default meta;
type Story = StoryObj<typeof DocumentCard>;

export const Default: Story = {
  args: {
    document: baseDocument,
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const AnalysisComplete: Story = {
  args: {
    document: { ...baseDocument, analysisStatus: "complete" },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const AnalysisAnalyzing: Story = {
  args: {
    document: { ...baseDocument, analysisStatus: "analyzing" },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const AnalysisQueued: Story = {
  args: {
    document: { ...baseDocument, analysisStatus: "queued" },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const AnalysisFailed: Story = {
  args: {
    document: { ...baseDocument, analysisStatus: "failed" },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const NoAnalysis: Story = {
  args: {
    document: { ...baseDocument, analysisStatus: "none" },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const ArchitectureCategory: Story = {
  args: {
    document: {
      ...baseDocument,
      _id: "doc-002",
      fileName: "System-Architecture-Diagram.png",
      fileType: "image/png",
      fileSize: 850000,
      category: "architecture",
      description: "High-level system architecture for the new platform.",
      analysisStatus: "none",
    },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const MeetingNotesCategory: Story = {
  args: {
    document: {
      ...baseDocument,
      _id: "doc-003",
      fileName: "Sprint-5-Retrospective-Notes.docx",
      fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSize: 45000,
      category: "meeting_notes",
      description: undefined,
      analysisStatus: "complete",
    },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const NoDownloadUrl: Story = {
  args: {
    document: { ...baseDocument, downloadUrl: null },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const LongFileName: Story = {
  args: {
    document: {
      ...baseDocument,
      fileName:
        "Acme-Comprehensive-Requirements-Specification-Salesforce-B2B-Commerce-Migration-v3-FINAL-reviewed.pdf",
    },
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
};

export const ClickDelete: Story = {
  args: {
    document: baseDocument,
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const deleteBtn = canvas.getByTitle("Delete");
    await userEvent.click(deleteBtn);
  },
};

export const ClickViewAnalysis: Story = {
  args: {
    document: baseDocument,
    onDelete: fn(),
    onViewAnalysis: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const analyzedBtn = canvas.getByText("Analyzed");
    await userEvent.click(analyzedBtn);
  },
};
