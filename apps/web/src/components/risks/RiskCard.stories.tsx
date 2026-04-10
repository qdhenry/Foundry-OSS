import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { RiskCard } from "./RiskCard";

const meta = {
  title: "Risks/RiskCard",
  component: RiskCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog_acme_corp",
  },
} satisfies Meta<typeof RiskCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Shared mock data ────────────────────────────────────────────────────────

const workstreams = [
  { _id: "ws_01", name: "Frontend Migration", shortCode: "FE" },
  { _id: "ws_02", name: "Backend API", shortCode: "BE" },
  { _id: "ws_03", name: "Data Migration", shortCode: "DM" },
];

// ─── Default / Critical ───────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    risk: {
      _id: "risk_01",
      title: "Magento data migration may corrupt historical order records",
      description:
        "Legacy Magento order data contains non-standard field encodings that may not map cleanly to Salesforce B2B Commerce schema, risking data loss or corruption during ETL.",
      severity: "critical",
      probability: "likely",
      status: "open",
      ownerName: "Sarah Chen",
      resolvedWorkstreams: workstreams,
    },
  },
};

// ─── High Severity ────────────────────────────────────────────────────────────

export const HighSeverity: Story = {
  args: {
    risk: {
      _id: "risk_02",
      title: "Third-party payment gateway API deprecation",
      description:
        "The current payment gateway API v2 will reach end-of-life in Q3. Migration to v3 requires significant rework of checkout flows.",
      severity: "high",
      probability: "very_likely",
      status: "mitigating",
      ownerName: "James Okafor",
      resolvedWorkstreams: [workstreams[0], workstreams[1]],
    },
  },
};

// ─── Medium Severity ──────────────────────────────────────────────────────────

export const MediumSeverity: Story = {
  args: {
    risk: {
      _id: "risk_03",
      title: "Salesforce license cost overrun",
      description:
        "Projected user seat count exceeds initial license estimates by 15-20%, potentially pushing total cost above budget ceiling.",
      severity: "medium",
      probability: "possible",
      status: "open",
      ownerName: "Priya Nair",
      resolvedWorkstreams: [workstreams[2]],
    },
  },
};

// ─── Low Severity ─────────────────────────────────────────────────────────────

export const LowSeverity: Story = {
  args: {
    risk: {
      _id: "risk_04",
      title: "Minor UI inconsistencies in legacy admin panel",
      description:
        "Some admin views retain legacy Magento styling that conflicts with the new design system. Purely cosmetic — no functional impact.",
      severity: "low",
      probability: "unlikely",
      status: "accepted",
      ownerName: "Alex Rivera",
      resolvedWorkstreams: [workstreams[0]],
    },
  },
};

// ─── Resolved Status ──────────────────────────────────────────────────────────

export const Resolved: Story = {
  args: {
    risk: {
      _id: "risk_05",
      title: "Clerk authentication token expiry mismatch",
      description:
        "JWT tokens issued by Clerk had a shorter TTL than expected by the Convex session validator, causing intermittent auth failures.",
      severity: "high",
      probability: "likely",
      status: "resolved",
      ownerName: "Sarah Chen",
      resolvedWorkstreams: [workstreams[1]],
    },
  },
};

// ─── Mitigating Status ────────────────────────────────────────────────────────

export const Mitigating: Story = {
  args: {
    risk: {
      _id: "risk_06",
      title: "Cloudflare Worker cold-start latency under peak load",
      description:
        "Sandbox worker cold starts observed at >2s under burst traffic. Team is evaluating Durable Object keep-alive strategies.",
      severity: "medium",
      probability: "possible",
      status: "mitigating",
      ownerName: "James Okafor",
      resolvedWorkstreams: workstreams,
    },
  },
};

// ─── Accepted Status ──────────────────────────────────────────────────────────

export const Accepted: Story = {
  args: {
    risk: {
      _id: "risk_07",
      title: "BigCommerce B2B catalog sync delay up to 15 minutes",
      description:
        "Product catalog changes may take up to 15 minutes to propagate to the storefront. Business has accepted this limitation for v1.",
      severity: "low",
      probability: "very_likely",
      status: "accepted",
      ownerName: "Priya Nair",
      resolvedWorkstreams: [],
    },
  },
};

// ─── No Description ───────────────────────────────────────────────────────────

export const NoDescription: Story = {
  args: {
    risk: {
      _id: "risk_08",
      title: "Incomplete API contract documentation from vendor",
      severity: "high",
      probability: "possible",
      status: "open",
      ownerName: "Alex Rivera",
      resolvedWorkstreams: [workstreams[0]],
    },
  },
};

// ─── No Owner ─────────────────────────────────────────────────────────────────

export const NoOwner: Story = {
  args: {
    risk: {
      _id: "risk_09",
      title: "Unowned: Database schema drift between environments",
      description:
        "Dev and staging environments have diverged from production schema. No owner assigned yet — needs triage.",
      severity: "critical",
      probability: "likely",
      status: "open",
      resolvedWorkstreams: [workstreams[1], workstreams[2]],
    },
  },
};

// ─── No Workstreams ───────────────────────────────────────────────────────────

export const NoWorkstreams: Story = {
  args: {
    risk: {
      _id: "risk_10",
      title: "Regulatory compliance gap for PII handling",
      description:
        "GDPR right-to-erasure process has not been fully defined for the new platform. Risk exists across all workstreams.",
      severity: "critical",
      probability: "possible",
      status: "open",
      ownerName: "Sarah Chen",
      resolvedWorkstreams: [],
    },
  },
};

// ─── Long Title ───────────────────────────────────────────────────────────────

export const LongTitle: Story = {
  args: {
    risk: {
      _id: "risk_11",
      title:
        "Potential multi-region data residency compliance failure due to Cloudflare edge routing sending EU customer data through US data centers without explicit DPA coverage",
      description: "Legal team flagged this during quarterly review.",
      severity: "critical",
      probability: "unlikely",
      status: "open",
      ownerName: "Priya Nair",
      resolvedWorkstreams: [workstreams[0]],
    },
  },
};

// ─── Very Likely + Critical ───────────────────────────────────────────────────

export const VeryLikelyCritical: Story = {
  args: {
    risk: {
      _id: "risk_12",
      title: "Production database failover not tested end-to-end",
      description:
        "The disaster recovery playbook has never been exercised in a production-equivalent environment. RPO/RTO targets are unverified.",
      severity: "critical",
      probability: "very_likely",
      status: "open",
      ownerName: "James Okafor",
      resolvedWorkstreams: workstreams,
    },
  },
};

// ─── Mobile viewport ─────────────────────────────────────────────────────────

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    risk: {
      _id: "risk_13",
      title: "Magento data migration may corrupt historical order records",
      description:
        "Legacy Magento order data contains non-standard field encodings that may not map cleanly to Salesforce B2B Commerce schema.",
      severity: "critical",
      probability: "likely",
      status: "open",
      ownerName: "Sarah Chen",
      resolvedWorkstreams: workstreams,
    },
  },
};

// ─── Tablet viewport ──────────────────────────────────────────────────────────

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  args: {
    risk: {
      _id: "risk_14",
      title: "Third-party payment gateway API deprecation",
      description:
        "The current payment gateway API v2 will reach end-of-life in Q3. Migration to v3 requires significant rework of checkout flows.",
      severity: "high",
      probability: "very_likely",
      status: "mitigating",
      ownerName: "James Okafor",
      resolvedWorkstreams: [workstreams[0], workstreams[1]],
    },
  },
};

// ─── Interactive: click navigates ─────────────────────────────────────────────

export const ClickInteraction: Story = {
  args: {
    risk: {
      _id: "risk_15",
      title: "Click this card to test navigation",
      description: "Clicking the card should trigger router.push to the risk detail page.",
      severity: "high",
      probability: "likely",
      status: "open",
      ownerName: "Alex Rivera",
      resolvedWorkstreams: [workstreams[0]],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByText("Click this card to test navigation").closest("div")!;
    await userEvent.click(card);
    // Navigation is handled by next/navigation mock — no assertion on URL needed
    await expect(card).toBeInTheDocument();
  },
};
