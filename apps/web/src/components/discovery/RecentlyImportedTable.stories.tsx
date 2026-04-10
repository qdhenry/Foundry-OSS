import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "@storybook/test";
import { RecentlyImportedTable } from "./RecentlyImportedTable";

const meta: Meta<typeof RecentlyImportedTable> = {
  title: "Discovery/RecentlyImportedTable",
  component: RecentlyImportedTable,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof RecentlyImportedTable>;

// ── Mock data ────────────────────────────────────────────────────────

const mockWorkstreams = [
  { _id: "ws_001", name: "Commerce Platform" },
  { _id: "ws_002", name: "System Integrations" },
  { _id: "ws_003", name: "Data Migration" },
  { _id: "ws_004", name: "Checkout" },
  { _id: "ws_005", name: "Account Management" },
];

const mockItems = [
  {
    _id: "req_001",
    refId: "BM-001",
    title: "B2B Customer-Specific Pricing Catalogs",
    pipelineStage: "requirement",
    workstreamId: "ws_001",
    workstreamName: "Commerce Platform",
    sourceDocumentName: "AcmeCorp RFP v2.pdf",
    importedAt: new Date("2026-02-10T14:23:00Z").getTime(),
  },
  {
    _id: "req_002",
    refId: "BM-002",
    title: "PunchOut Catalog Support (cXML/OCI)",
    pipelineStage: "sprint_planning",
    workstreamId: "ws_004",
    workstreamName: "Checkout",
    sourceDocumentName: "AcmeCorp RFP v2.pdf",
    importedAt: new Date("2026-02-10T14:25:00Z").getTime(),
  },
  {
    _id: "req_003",
    refId: "BM-003",
    title: "SAP ERP Real-Time Integration",
    pipelineStage: "implementation",
    workstreamId: "ws_002",
    workstreamName: "System Integrations",
    sourceDocumentName: "Technical Discovery Notes.docx",
    importedAt: new Date("2026-02-11T09:12:00Z").getTime(),
  },
  {
    _id: "req_004",
    refId: "BM-004",
    title: "Multi-Account User Role Management",
    pipelineStage: "task_generation",
    workstreamId: "ws_005",
    workstreamName: "Account Management",
    sourceDocumentName: "AcmeCorp RFP v2.pdf",
    importedAt: new Date("2026-02-12T11:45:00Z").getTime(),
  },
  {
    _id: "req_005",
    refId: "BM-005",
    title: "SKU Data Cleansing Pre-Migration",
    pipelineStage: "subtask_generation",
    workstreamId: "ws_003",
    workstreamName: "Data Migration",
    sourceDocumentName: "Data Audit Report Q1.xlsx",
    importedAt: new Date("2026-02-13T16:00:00Z").getTime(),
  },
  {
    _id: "req_006",
    refId: "BM-006",
    title: "Avalara Tax Calculation Integration",
    pipelineStage: "testing",
    workstreamId: "ws_002",
    workstreamName: "System Integrations",
    sourceDocumentName: "Technical Discovery Notes.docx",
    importedAt: new Date("2026-02-14T08:30:00Z").getTime(),
  },
  {
    _id: "req_007",
    refId: "BM-007",
    title: "Configurable Product Builder with Rules Engine",
    pipelineStage: "review",
    workstreamId: "ws_001",
    workstreamName: "Commerce Platform",
    sourceDocumentName: "AcmeCorp RFP v2.pdf",
    importedAt: new Date("2026-02-15T10:20:00Z").getTime(),
  },
  {
    _id: "req_008",
    refId: "BM-008",
    title: "Quote Request Workflow",
    pipelineStage: "discovery",
    workstreamId: null,
    workstreamName: null,
    sourceDocumentName: "Stakeholder Interview Notes.pdf",
    importedAt: new Date("2026-02-16T13:55:00Z").getTime(),
  },
];

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    programId: "prog_acme_corp",
    data: { items: mockItems, continueCursor: null },
    workstreams: mockWorkstreams,
  },
};

export const Loading: Story = {
  name: "Loading State (skeleton rows)",
  args: {
    programId: "prog_acme_corp",
    data: undefined,
    workstreams: [],
  },
};

export const Empty: Story = {
  name: "Empty State (no imports yet)",
  args: {
    programId: "prog_acme_corp",
    data: { items: [], continueCursor: null },
    workstreams: mockWorkstreams,
  },
};

export const EmptyNoWorkstreams: Story = {
  name: "Empty — No Workstreams (no View All link)",
  args: {
    programId: "prog_acme_corp",
    data: { items: [], continueCursor: null },
    workstreams: [],
  },
};

export const SingleItem: Story = {
  name: "Single Imported Requirement",
  args: {
    programId: "prog_acme_corp",
    data: { items: [mockItems[0]], continueCursor: null },
    workstreams: mockWorkstreams,
  },
};

export const WithoutWorkstreamLinks: Story = {
  name: "Items Without Workstream Assignment",
  args: {
    programId: "prog_acme_corp",
    data: {
      items: mockItems.map((item) => ({
        ...item,
        workstreamId: null,
        workstreamName: null,
      })),
      continueCursor: null,
    },
    workstreams: [],
  },
};

export const AllPipelineStages: Story = {
  name: "All Pipeline Stages Represented",
  args: {
    programId: "prog_acme_corp",
    data: { items: mockItems, continueCursor: null },
    workstreams: mockWorkstreams,
  },
};

export const EarlyStagesOnly: Story = {
  name: "Early Pipeline Stages Only (discovery, requirement)",
  args: {
    programId: "prog_acme_corp",
    data: {
      items: mockItems.filter((item) => ["discovery", "requirement"].includes(item.pipelineStage)),
      continueCursor: null,
    },
    workstreams: mockWorkstreams,
  },
};

export const LateStagesOnly: Story = {
  name: "Late Pipeline Stages Only (testing, review)",
  args: {
    programId: "prog_acme_corp",
    data: {
      items: mockItems.filter((item) => ["testing", "review"].includes(item.pipelineStage)),
      continueCursor: null,
    },
    workstreams: mockWorkstreams,
  },
};

export const VerifyTableStructure: Story = {
  name: "Interaction — Verify Table Has Correct Headers",
  args: {
    programId: "prog_acme_corp",
    data: { items: mockItems, continueCursor: null },
    workstreams: mockWorkstreams,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("columnheader", { name: /ref id/i })).toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: /title/i })).toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: /pipeline stage/i })).toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: /workstream/i })).toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: /source/i })).toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: /imported/i })).toBeInTheDocument();
  },
};

export const VerifyItemCount: Story = {
  name: "Interaction — Verify Correct Item Count Shown",
  args: {
    programId: "prog_acme_corp",
    data: { items: mockItems, continueCursor: null },
    workstreams: mockWorkstreams,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(`Recently Imported (${mockItems.length})`)).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  args: {
    programId: "prog_acme_corp",
    data: { items: mockItems.slice(0, 4), continueCursor: null },
    workstreams: mockWorkstreams,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    programId: "prog_acme_corp",
    data: { items: mockItems, continueCursor: null },
    workstreams: mockWorkstreams,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
