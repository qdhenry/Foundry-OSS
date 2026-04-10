import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import type { FindingData } from "./FindingCard";
import { FindingEditModal } from "./FindingEditModal";

const requirementFinding: FindingData = {
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

const riskFinding: FindingData = {
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
      "AcmeCorp's hospital customers rely on EDI 850/856/810 transactions. Salesforce B2B Commerce does not natively support EDI, requiring a third-party middleware solution.",
    severity: "high",
    probability: "likely",
    mitigation:
      "Evaluate SPS Commerce or TrueCommerce EDI middleware. Budget for 3-month integration sprint in Phase 2.",
  },
};

const integrationFinding: FindingData = {
  _id: "finding-int-1",
  type: "integration",
  status: "approved",
  confidence: "high",
  documentName: "Architecture_Review.pdf",
  data: {
    name: "ERP Order Sync",
    sourceSystem: "Salesforce B2B Commerce",
    targetSystem: "SAP ERP",
    protocol: "api",
    description:
      "Real-time order sync from Salesforce B2B Commerce to SAP ERP via REST API. Orders placed in Salesforce must appear in SAP within 60 seconds.",
  },
};

const decisionFinding: FindingData = {
  _id: "finding-dec-1",
  type: "decision",
  status: "pending",
  confidence: "medium",
  documentName: "Discovery_Workshop_Notes.pdf",
  data: {
    title: "Select EDI middleware vendor for hospital procurement integration",
    description:
      "A vendor must be selected for EDI middleware to bridge Salesforce B2B Commerce and legacy hospital procurement systems. Shortlist includes SPS Commerce, TrueCommerce, and DiCentral.",
    impact: "high",
    category: "technical",
  },
};

const meta: Meta<typeof FindingEditModal> = {
  title: "Discovery/FindingEditModal",
  component: FindingEditModal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof FindingEditModal>;

export const RequirementType: Story = {
  name: "Requirement Finding",
  args: {
    finding: requirementFinding,
  },
};

export const RiskType: Story = {
  name: "Risk Finding",
  args: {
    finding: riskFinding,
  },
};

export const IntegrationType: Story = {
  name: "Integration Finding",
  args: {
    finding: integrationFinding,
  },
};

export const DecisionType: Story = {
  name: "Decision Finding",
  args: {
    finding: decisionFinding,
  },
};

export const Closed: Story = {
  name: "Closed (renders nothing)",
  args: {
    finding: requirementFinding,
    isOpen: false,
  },
};

export const NullFinding: Story = {
  name: "Null Finding (renders nothing)",
  args: {
    finding: null,
    isOpen: true,
  },
};

export const EditInteraction: Story = {
  name: "Edit Requirement Fields (interaction)",
  args: {
    finding: requirementFinding,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const titleInput = canvas.getByDisplayValue(
      "Product catalog data migration with zero data loss",
    );
    await userEvent.tripleClick(titleInput);
    await userEvent.type(
      titleInput,
      "Full product catalog migration — 45k SKUs, pricing, and hierarchy",
    );

    const prioritySelect = canvas.getByDisplayValue("Must Have");
    await userEvent.selectOptions(prioritySelect, "should_have");
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    finding: requirementFinding,
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  args: {
    finding: riskFinding,
  },
};
