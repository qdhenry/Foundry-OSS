import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { FindingCard, type FindingData } from "./FindingCard";

const meta: Meta<typeof FindingCard> = {
  title: "Discovery/FindingCard",
  component: FindingCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onApprove: fn(),
    onReject: fn(),
    onEdit: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof FindingCard>;

// ── Mock data ────────────────────────────────────────────────────────

const requirementPending: FindingData = {
  _id: "finding_001",
  type: "requirement",
  status: "pending",
  confidence: "high",
  suggestedWorkstream: "Commerce Platform",
  sourceExcerpt:
    "The system must support B2B customer-specific pricing catalogs, enabling negotiated rates per account with a minimum of 500 price tiers per catalog.",
  documentName: "AcmeCorp RFP v2.pdf",
  data: {
    title: "B2B Customer-Specific Pricing Catalogs",
    description:
      "Implement support for account-level pricing catalogs that allow sales teams to configure negotiated rates per customer. Each catalog must support a minimum of 500 price tiers and integrate with the ERP for real-time price sync. Pricing changes must propagate within 15 minutes of an update.",
  },
};

const riskPending: FindingData = {
  _id: "finding_002",
  type: "risk",
  status: "pending",
  confidence: "medium",
  suggestedWorkstream: "Data Migration",
  sourceExcerpt:
    "Legacy Magento database contains approximately 2.3 million SKUs with inconsistent attribute mappings that may not translate directly to Salesforce B2B Commerce data model.",
  documentName: "Technical Discovery Notes.docx",
  data: {
    title: "SKU Data Quality Risk During Migration",
    description:
      "2.3M legacy SKUs have inconsistent attribute mappings that risk data loss or corruption during migration to Salesforce B2B Commerce. A data cleansing phase is required prior to ETL.",
  },
};

const integrationPending: FindingData = {
  _id: "finding_003",
  type: "integration",
  status: "pending",
  confidence: "high",
  suggestedWorkstream: "System Integrations",
  sourceExcerpt:
    "SAP ERP integration required for real-time inventory, order management, and customer account data synchronization.",
  documentName: "AcmeCorp RFP v2.pdf",
  data: {
    title: "SAP ERP Real-Time Integration",
    description:
      "Bidirectional integration between the commerce platform and SAP ERP for inventory levels, order lifecycle events, customer account data, and pricing. Must maintain sub-30-second sync latency.",
  },
};

const decisionPending: FindingData = {
  _id: "finding_004",
  type: "decision",
  status: "pending",
  confidence: "low",
  suggestedWorkstream: "Architecture",
  data: {
    title: "Platform Selection: Salesforce B2B Commerce vs BigCommerce B2B",
    description:
      "Stakeholders have not aligned on a target platform. Both Salesforce B2B Commerce and BigCommerce B2B were referenced in discovery sessions. A formal evaluation and sign-off is required before architecture work begins.",
  },
};

const requirementApproved: FindingData = {
  _id: "finding_005",
  type: "requirement",
  status: "approved",
  confidence: "high",
  suggestedWorkstream: "Checkout",
  data: {
    title: "PunchOut Catalog Support (cXML/OCI)",
    description:
      "Enable procurement system integration via cXML and OCI PunchOut protocols. Buyers must be able to initiate sessions from their eProcurement platform and return filled carts.",
  },
};

const requirementRejected: FindingData = {
  _id: "finding_006",
  type: "requirement",
  status: "rejected",
  confidence: "low",
  data: {
    title: "Legacy EDI 850 Direct Integration",
    description:
      "Direct EDI 850 purchase order ingestion was marked as out of scope; orders will route through the API layer instead.",
  },
};

const requirementEdited: FindingData = {
  _id: "finding_007",
  type: "requirement",
  status: "edited",
  confidence: "medium",
  suggestedWorkstream: "Catalog Management",
  data: {
    title: "Product Configurator",
    description: "Original AI extraction.",
  },
  editedData: {
    title: "Configurable Product Builder with Rules Engine",
    description:
      "Allow customers to configure complex regulated products bundles using a guided rules-based configurator. Configuration rules must be manageable by catalog admins without code changes.",
  },
};

const requirementImported: FindingData = {
  _id: "finding_008",
  type: "requirement",
  status: "imported",
  confidence: "high",
  suggestedWorkstream: "Account Management",
  data: {
    title: "Multi-Account User Role Management",
    description:
      "Users may belong to multiple purchasing accounts with different roles and permissions per account. Role assignments must sync from Salesforce CRM.",
  },
};

const shortDescriptionFinding: FindingData = {
  _id: "finding_009",
  type: "requirement",
  status: "pending",
  confidence: "high",
  data: {
    title: "Quote Request Workflow",
    description: "Allow logged-in B2B users to request custom quotes.",
  },
};

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    finding: requirementPending,
  },
};

export const PendingRequirement: Story = {
  name: "Pending — Requirement (High Confidence)",
  args: {
    finding: requirementPending,
  },
};

export const PendingRisk: Story = {
  name: "Pending — Risk (Medium Confidence)",
  args: {
    finding: riskPending,
  },
};

export const PendingIntegration: Story = {
  name: "Pending — Integration (High Confidence)",
  args: {
    finding: integrationPending,
  },
};

export const PendingDecision: Story = {
  name: "Pending — Decision (Low Confidence)",
  args: {
    finding: decisionPending,
  },
};

export const Approved: Story = {
  args: {
    finding: requirementApproved,
  },
};

export const Rejected: Story = {
  args: {
    finding: requirementRejected,
  },
};

export const Edited: Story = {
  args: {
    finding: requirementEdited,
  },
};

export const Imported: Story = {
  args: {
    finding: requirementImported,
  },
};

export const ShortDescription: Story = {
  name: "Pending — Short Description (no expand button)",
  args: {
    finding: shortDescriptionFinding,
  },
};

export const NoSourceExcerpt: Story = {
  name: "Pending — No Source Excerpt",
  args: {
    finding: {
      ...requirementPending,
      sourceExcerpt: undefined,
    },
  },
};

export const NoWorkstream: Story = {
  name: "Pending — No Suggested Workstream",
  args: {
    finding: {
      ...requirementPending,
      suggestedWorkstream: undefined,
    },
  },
};

export const ExpandCollapse: Story = {
  name: "Interaction — Expand/Collapse Long Description",
  args: {
    finding: requirementPending,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const showMoreBtn = canvas.getByRole("button", { name: /show more/i });
    await expect(showMoreBtn).toBeInTheDocument();
    await userEvent.click(showMoreBtn);
    await expect(canvas.getByRole("button", { name: /show less/i })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /show less/i }));
    await expect(canvas.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  },
};

export const ApproveAction: Story = {
  name: "Interaction — Approve Button",
  args: {
    finding: requirementPending,
    onApprove: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const approveBtn = canvas.getByRole("button", { name: /approve finding/i });
    await userEvent.click(approveBtn);
    await expect(args.onApprove).toHaveBeenCalledWith("finding_001");
  },
};

export const RejectAction: Story = {
  name: "Interaction — Reject Button",
  args: {
    finding: requirementPending,
    onReject: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const rejectBtn = canvas.getByRole("button", { name: /reject finding/i });
    await userEvent.click(rejectBtn);
    await expect(args.onReject).toHaveBeenCalledWith("finding_001");
  },
};

export const EditAction: Story = {
  name: "Interaction — Edit Button",
  args: {
    finding: requirementPending,
    onEdit: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const editBtn = canvas.getByRole("button", { name: /edit finding/i });
    await userEvent.click(editBtn);
    await expect(args.onEdit).toHaveBeenCalledWith("finding_001");
  },
};

export const Mobile: Story = {
  args: {
    finding: requirementPending,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    finding: integrationPending,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
