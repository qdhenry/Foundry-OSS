import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DiscoveryPage from "./page";

const meta = {
  title: "Pages/Discovery/Main",
  component: DiscoveryPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DiscoveryPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    convexMockData: {
      "documents:listByProgram": [
        {
          _id: "doc-1" as any,
          _creationTime: Date.now(),
          name: "Gap Analysis Report.pdf",
          analysisStatus: "complete",
          programId: "prog-acme-demo",
        },
        {
          _id: "doc-2" as any,
          _creationTime: Date.now() - 86400000,
          name: "Platform Audit.docx",
          analysisStatus: "analyzing",
          programId: "prog-acme-demo",
        },
      ],
      "requirements:recentlyImported": {
        items: [
          {
            _id: "imp-1" as any,
            refId: "REQ-001",
            title: "Product SKU Mapping",
            priority: "must_have",
            status: "approved",
            importedAt: Date.now() - 3600000,
          },
        ],
      },
    },
  },
};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "requirements:listByProgram": [],
      "requirements:countByStatus": { open: 0, in_progress: 0, complete: 0, blocked: 0, total: 0 },
      "documents:listByProgram": [],
      "discoveryFindings:countPending": { count: 0 },
      "requirements:recentlyImported": { items: [] },
    },
  },
};

export const Mobile: Story = {
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: "mobile" },
  },
};
