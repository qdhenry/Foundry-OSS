import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { ReviewStep } from "./ReviewStep";

const mockFindings = [
  {
    _id: "finding_001",
    _creationTime: Date.now() - 3600000,
    type: "requirement",
    status: "pending",
    confidence: "high",
    sourceExcerpt:
      "The system must support B2B account hierarchies with parent/child relationships.",
    data: { title: "B2B Account Hierarchy Support" },
    editedData: null,
    sourceAttribution: {},
  },
  {
    _id: "finding_002",
    _creationTime: Date.now() - 3500000,
    type: "requirement",
    status: "approved",
    confidence: "high",
    sourceExcerpt: "Product catalog must support tiered pricing by account segment.",
    data: { title: "Tiered Pricing by Account Segment" },
    editedData: null,
    sourceAttribution: {},
  },
  {
    _id: "finding_003",
    _creationTime: Date.now() - 3400000,
    type: "requirement",
    status: "rejected",
    confidence: "medium",
    sourceExcerpt: "Legacy integration with AS400 mainframe required.",
    data: { title: "AS400 Mainframe Integration" },
    editedData: null,
    sourceAttribution: {},
  },
  {
    _id: "finding_004",
    _creationTime: Date.now() - 3300000,
    type: "risk",
    status: "pending",
    confidence: "high",
    sourceExcerpt: "Data migration from Magento may result in loss of historical order data.",
    data: { title: "Historical Order Data Loss During Migration" },
    editedData: null,
    sourceAttribution: {},
  },
  {
    _id: "finding_005",
    _creationTime: Date.now() - 3200000,
    type: "integration",
    status: "pending",
    confidence: "medium",
    sourceExcerpt: "ERP system (SAP) must be integrated for inventory synchronization.",
    data: { title: "SAP ERP Inventory Sync" },
    editedData: null,
    sourceAttribution: {},
  },
  {
    _id: "finding_006",
    _creationTime: Date.now() - 3100000,
    type: "decision",
    status: "pending",
    confidence: "low",
    sourceExcerpt:
      "Decision on CDN provider for media assets is still pending stakeholder approval.",
    data: { title: "CDN Provider Selection" },
    editedData: null,
    sourceAttribution: {},
  },
];

const meta: Meta<typeof ReviewStep> = {
  title: "Programs/Wizard/ReviewStep",
  component: ReviewStep,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    convex: {
      "discoveryFindings.listByProgram": mockFindings,
    },
  },
  args: {
    programId: "program_demo_001",
    onNext: fn(),
    onBack: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReviewStep>;

export const WithFindings: Story = {
  name: "With Findings — Mixed Statuses",
};

export const AllPending: Story = {
  name: "All Findings Pending",
  parameters: {
    convex: {
      "discoveryFindings.listByProgram": mockFindings.map((f) => ({
        ...f,
        status: "pending",
      })),
    },
  },
};

export const AllApproved: Story = {
  name: "All Findings Approved",
  parameters: {
    convex: {
      "discoveryFindings.listByProgram": mockFindings.map((f) => ({
        ...f,
        status: "approved",
      })),
    },
  },
};

export const NoFindings: Story = {
  name: "No Findings (Empty State)",
  parameters: {
    convex: {
      "discoveryFindings.listByProgram": [],
    },
  },
};

export const RisksTab: Story = {
  name: "Risks Tab Active",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const risksTab = canvas.getByRole("button", { name: /risks/i });
    await userEvent.click(risksTab);
  },
};

export const IntegrationsTab: Story = {
  name: "Integrations Tab Active",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tab = canvas.getByRole("button", { name: /integrations/i });
    await userEvent.click(tab);
  },
};

export const PendingWarningTriggered: Story = {
  name: "Pending Warning Triggered on Next",
  parameters: {
    convex: {
      "discoveryFindings.listByProgram": mockFindings.filter((f) => f.status === "pending"),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nextButton = canvas.getByRole("button", { name: /next/i });
    await userEvent.click(nextButton);
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "discoveryFindings.listByProgram": mockFindings,
    },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "discoveryFindings.listByProgram": mockFindings,
    },
  },
};
