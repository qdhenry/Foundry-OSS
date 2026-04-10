import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { MergeableFindingCard } from "./MergeableFindingCard";

const mockRequirements = [
  {
    _id: "req-1",
    refId: "BM-001",
    title: "Product catalog migration from Magento to Salesforce B2B Commerce",
  },
  { _id: "req-2", refId: "BM-002", title: "B2B pricing rules and tiered discount configuration" },
  { _id: "req-3", refId: "BM-003", title: "Purchase order workflow and net terms payment support" },
  { _id: "req-4", refId: "BM-004", title: "Customer account hierarchy management and buyer roles" },
  { _id: "req-5", refId: "BM-005", title: "ERP order sync integration via REST API" },
];

const pendingRequirementFinding = {
  _id: "finding-req-1",
  type: "requirement",
  status: "pending",
  confidence: "high",
  documentName: "Acme_RFP.pdf",
  sourceExcerpt:
    "All product data including SKUs, pricing tiers, and category assignments must be migrated without data loss.",
  data: {
    title: "Product catalog data migration with zero data loss",
    description:
      "Migrate all 45,000 AcmeCorp product SKUs from Magento to Salesforce B2B Commerce Cloud, preserving pricing rules, tiered discounts, category hierarchy, and product attributes.",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
  },
};

const pendingRiskFinding = {
  _id: "finding-risk-1",
  type: "risk",
  status: "pending",
  confidence: "medium",
  documentName: "Migration_Risk_Assessment.docx",
  sourceExcerpt:
    "EDI integrations with hospital procurement systems represent a significant technical dependency.",
  data: {
    title: "EDI integration compatibility risk with legacy hospital procurement systems",
    description:
      "AcmeCorp hospital customers rely on EDI 850/856/810 transactions. Salesforce B2B Commerce does not natively support EDI, requiring third-party middleware.",
    severity: "high",
    probability: "likely",
    mitigation: "Evaluate SPS Commerce or TrueCommerce EDI middleware.",
  },
};

const approvedFinding = {
  _id: "finding-req-2",
  type: "requirement",
  status: "approved",
  confidence: "high",
  documentName: "Architecture_Review.pdf",
  data: {
    title: "Real-time inventory visibility across distribution centers",
    description:
      "Sales reps and customers must see live inventory levels for AcmeCorp's four distribution centers during order entry.",
    priority: "should_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
  },
};

const rejectedFinding = {
  _id: "finding-req-3",
  type: "requirement",
  status: "rejected",
  confidence: "low",
  documentName: "Discovery_Workshop_Notes.pdf",
  data: {
    title: "Legacy EDI integration with municipal hospital procurement portals",
    description: "Low confidence extraction — may duplicate BM-005. Needs human review.",
  },
};

const importedFinding = {
  _id: "finding-req-4",
  type: "requirement",
  status: "imported",
  confidence: "high",
  documentName: "Acme_RFP.pdf",
  data: {
    title: "Sales rep quote management and approval workflow",
    description:
      "AcmeCorp sales reps must be able to create, send, and track customer quotes with multi-level approval routing.",
    priority: "must_have",
    fitGap: "config",
    effortEstimate: "medium",
  },
};

const findingWithPotentialMatch = {
  _id: "finding-req-5",
  type: "requirement",
  status: "pending",
  confidence: "high",
  documentName: "Requirements_Supplement.pdf",
  sourceExcerpt: "Order management system must synchronize with SAP ERP in real time.",
  data: {
    title: "ERP order sync with real-time confirmation",
    description:
      "Orders must be pushed to SAP ERP within 60 seconds of placement, with status callbacks updating Salesforce B2B Commerce.",
    priority: "must_have",
    fitGap: "custom_dev",
    effortEstimate: "high",
    potentialMatch: "ERP order sync integration via REST API",
  },
};

const integrationFinding = {
  _id: "finding-int-1",
  type: "integration",
  status: "pending",
  confidence: "high",
  documentName: "Architecture_Review.pdf",
  data: {
    name: "Salesforce B2B ↔ SAP ERP Order Sync",
    sourceSystem: "Salesforce B2B Commerce",
    targetSystem: "SAP ERP",
    protocol: "api",
    description:
      "Bi-directional order and inventory sync between Salesforce B2B Commerce and SAP ERP via REST API with webhook callbacks.",
  },
};

const meta: Meta<typeof MergeableFindingCard> = {
  title: "Discovery/MergeableFindingCard",
  component: MergeableFindingCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    requirements: mockRequirements,
    isBusy: false,
    isMerged: false,
    onApprove: fn(),
    onReject: fn(),
    onMerge: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof MergeableFindingCard>;

export const PendingRequirement: Story = {
  name: "Pending — Requirement",
  args: {
    finding: pendingRequirementFinding,
  },
};

export const PendingRisk: Story = {
  name: "Pending — Risk",
  args: {
    finding: pendingRiskFinding,
  },
};

export const PendingIntegration: Story = {
  name: "Pending — Integration",
  args: {
    finding: integrationFinding,
  },
};

export const ApprovedFinding: Story = {
  name: "Approved",
  args: {
    finding: approvedFinding,
  },
};

export const RejectedFinding: Story = {
  name: "Rejected",
  args: {
    finding: rejectedFinding,
  },
};

export const ImportedFinding: Story = {
  name: "Imported",
  args: {
    finding: importedFinding,
  },
};

export const WithPotentialMatch: Story = {
  name: "With Potential Match",
  args: {
    finding: findingWithPotentialMatch,
  },
};

export const MergeControlsOpen: Story = {
  name: "Merge Controls Open (interaction)",
  args: {
    finding: findingWithPotentialMatch,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mergeButton = canvas.getByText("Merge into existing");
    await userEvent.click(mergeButton);
  },
};

export const BusyState: Story = {
  name: "Busy / Loading",
  args: {
    finding: pendingRequirementFinding,
    isBusy: true,
  },
};

export const MergedState: Story = {
  name: "Merged",
  args: {
    finding: findingWithPotentialMatch,
    isMerged: true,
  },
};

export const WithSourceExcerpt: Story = {
  name: "With Source Excerpt",
  args: {
    finding: {
      ...pendingRequirementFinding,
      sourceExcerpt:
        "Section 4.2: The new platform must support the complete AcmeCorp product catalog of approximately 45,000 active SKUs across 12 product categories including industrial supplies, equipment, and consumables.",
    },
  },
};

export const NoRequirementsForMerge: Story = {
  name: "No Requirements (empty merge list)",
  args: {
    finding: findingWithPotentialMatch,
    requirements: [],
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    finding: pendingRequirementFinding,
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  args: {
    finding: findingWithPotentialMatch,
  },
};
