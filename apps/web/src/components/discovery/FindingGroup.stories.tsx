import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import type { FindingData } from "./FindingCard";
import { FindingGroup } from "./FindingGroup";

const meta: Meta<typeof FindingGroup> = {
  title: "Discovery/FindingGroup",
  component: FindingGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onApprove: fn(),
    onReject: fn(),
    onEdit: fn(),
    onBulkApprove: fn(),
    onBulkReject: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof FindingGroup>;

// ── Mock findings ────────────────────────────────────────────────────

const pendingRequirements: FindingData[] = [
  {
    _id: "req_001",
    type: "requirement",
    status: "pending",
    confidence: "high",
    suggestedWorkstream: "Commerce Platform",
    sourceExcerpt:
      "The system must support B2B customer-specific pricing catalogs with a minimum of 500 price tiers per catalog.",
    data: {
      title: "B2B Customer-Specific Pricing Catalogs",
      description:
        "Implement account-level pricing catalogs with negotiated rates per customer. Supports 500+ price tiers and real-time ERP sync.",
    },
  },
  {
    _id: "req_002",
    type: "requirement",
    status: "pending",
    confidence: "high",
    suggestedWorkstream: "Checkout",
    sourceExcerpt:
      "PunchOut catalog support via cXML and OCI protocols required for procurement system integration.",
    data: {
      title: "PunchOut Catalog Support (cXML/OCI)",
      description:
        "Enable procurement system integration via cXML and OCI PunchOut. Buyers initiate sessions from eProcurement and return filled carts.",
    },
  },
  {
    _id: "req_003",
    type: "requirement",
    status: "approved",
    confidence: "medium",
    suggestedWorkstream: "Account Management",
    data: {
      title: "Multi-Account User Role Management",
      description:
        "Users may belong to multiple purchasing accounts with different roles per account. Role assignments sync from Salesforce CRM.",
    },
  },
];

const pendingRisks: FindingData[] = [
  {
    _id: "risk_001",
    type: "risk",
    status: "pending",
    confidence: "medium",
    suggestedWorkstream: "Data Migration",
    sourceExcerpt:
      "Legacy Magento database contains approximately 2.3 million SKUs with inconsistent attribute mappings.",
    data: {
      title: "SKU Data Quality Risk During Migration",
      description:
        "2.3M legacy SKUs have inconsistent attribute mappings that risk data loss or corruption during migration. A data cleansing phase is required prior to ETL.",
    },
  },
  {
    _id: "risk_002",
    type: "risk",
    status: "rejected",
    confidence: "low",
    data: {
      title: "Third-Party Payment Gateway Deprecation",
      description:
        "Current payment gateway announced end-of-life for legacy API in Q4. Integration team confirmed this is handled separately.",
    },
  },
];

const pendingIntegrations: FindingData[] = [
  {
    _id: "int_001",
    type: "integration",
    status: "pending",
    confidence: "high",
    suggestedWorkstream: "System Integrations",
    sourceExcerpt:
      "SAP ERP integration required for real-time inventory, order management, and customer account data synchronization.",
    data: {
      title: "SAP ERP Real-Time Integration",
      description:
        "Bidirectional integration between the commerce platform and SAP ERP for inventory, orders, customer accounts, and pricing. Sub-30-second sync latency required.",
    },
  },
  {
    _id: "int_002",
    type: "integration",
    status: "pending",
    confidence: "high",
    suggestedWorkstream: "System Integrations",
    data: {
      title: "Salesforce CRM Account Sync",
      description:
        "Sync customer account hierarchy, contacts, and roles from Salesforce CRM to ensure B2B buyer management reflects sales data.",
    },
  },
  {
    _id: "int_003",
    type: "integration",
    status: "pending",
    confidence: "medium",
    suggestedWorkstream: "System Integrations",
    data: {
      title: "Avalara Tax Calculation API",
      description:
        "Integrate Avalara AvaTax for real-time sales tax calculation at checkout, with jurisdiction-specific rules for all 50 US states.",
    },
  },
];

const pendingDecisions: FindingData[] = [
  {
    _id: "dec_001",
    type: "decision",
    status: "pending",
    confidence: "low",
    data: {
      title: "Platform Selection: Salesforce B2B Commerce vs BigCommerce B2B",
      description:
        "Stakeholders have not aligned on a target platform. A formal evaluation and sign-off is required before architecture work begins.",
    },
  },
];

const allApprovedRequirements: FindingData[] = [
  {
    _id: "req_a01",
    type: "requirement",
    status: "approved",
    confidence: "high",
    suggestedWorkstream: "Commerce Platform",
    data: {
      title: "B2B Customer-Specific Pricing Catalogs",
      description: "Account-level pricing with 500+ tiers and ERP sync.",
    },
  },
  {
    _id: "req_a02",
    type: "requirement",
    status: "imported",
    confidence: "high",
    suggestedWorkstream: "Checkout",
    data: {
      title: "PunchOut Catalog Support (cXML/OCI)",
      description: "Procurement system integration via cXML and OCI PunchOut.",
    },
  },
];

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    type: "requirement",
    findings: pendingRequirements,
  },
};

export const RequirementsGroup: Story = {
  name: "Requirements — Mixed Statuses",
  args: {
    type: "requirement",
    findings: pendingRequirements,
  },
};

export const RisksGroup: Story = {
  name: "Risks — Mixed Statuses",
  args: {
    type: "risk",
    findings: pendingRisks,
  },
};

export const IntegrationsGroup: Story = {
  name: "Integrations — All Pending",
  args: {
    type: "integration",
    findings: pendingIntegrations,
  },
};

export const DecisionsGroup: Story = {
  name: "Decisions — Single Item",
  args: {
    type: "decision",
    findings: pendingDecisions,
  },
};

export const AllApproved: Story = {
  name: "Requirements — All Approved (no bulk actions)",
  args: {
    type: "requirement",
    findings: allApprovedRequirements,
  },
};

export const Empty: Story = {
  name: "Empty State",
  args: {
    type: "requirement",
    findings: [],
  },
};

export const EmptyRisks: Story = {
  name: "Empty State — Risks",
  args: {
    type: "risk",
    findings: [],
  },
};

export const BulkApproveAction: Story = {
  name: "Interaction — Bulk Approve All",
  args: {
    type: "requirement",
    findings: pendingRequirements,
    onBulkApprove: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const bulkApproveBtn = canvas.getByRole("button", {
      name: /approve all pending requirements/i,
    });
    await expect(bulkApproveBtn).toBeInTheDocument();
    await userEvent.click(bulkApproveBtn);
    await expect(args.onBulkApprove).toHaveBeenCalledWith(["req_001", "req_002"]);
  },
};

export const BulkRejectAction: Story = {
  name: "Interaction — Bulk Reject All",
  args: {
    type: "requirement",
    findings: pendingRequirements,
    onBulkReject: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const bulkRejectBtn = canvas.getByRole("button", {
      name: /reject all pending requirements/i,
    });
    await expect(bulkRejectBtn).toBeInTheDocument();
    await userEvent.click(bulkRejectBtn);
    await expect(args.onBulkReject).toHaveBeenCalledWith(["req_001", "req_002"]);
  },
};

export const Mobile: Story = {
  args: {
    type: "requirement",
    findings: pendingRequirements,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    type: "integration",
    findings: pendingIntegrations,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
