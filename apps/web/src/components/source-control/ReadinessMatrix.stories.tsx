import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReadinessMatrix } from "./ReadinessMatrix";

const makeEntry = (
  id: string,
  refId: string,
  title: string,
  scope: number,
  impl: number,
  quadrant: string,
  isWarning = false,
) => ({
  requirementId: id,
  refId,
  title,
  scopeCompleteness: scope,
  implementationCompleteness: impl,
  quadrant,
  color: "#000",
  description: `${title} — scope ${scope}%, impl ${impl}%`,
  isWarning,
});

const FULL_MATRIX_DATA = {
  totalRequirements: 18,
  warningCount: 3,
  summary: {
    READY: 4,
    IN_PROGRESS: 3,
    SPECIFIED: 2,
    DEFINED: 2,
    RISKY: 1,
    REVIEW: 2,
    BACKLOG: 1,
    DANGER: 2,
    ROGUE: 1,
  },
  entries: [
    makeEntry("r1", "REQ-001", "B2B Checkout Flow", 95, 90, "READY"),
    makeEntry("r2", "REQ-002", "Account Management Portal", 88, 85, "READY"),
    makeEntry("r3", "REQ-003", "Product Catalog Sync", 92, 78, "READY"),
    makeEntry("r4", "REQ-004", "Order Management API", 80, 72, "READY"),
    makeEntry("r5", "REQ-005", "Cart Persistence Service", 75, 55, "IN_PROGRESS"),
    makeEntry("r6", "REQ-006", "Pricing Rules Engine", 70, 60, "IN_PROGRESS"),
    makeEntry("r7", "REQ-007", "Promotion Engine", 68, 45, "IN_PROGRESS"),
    makeEntry("r8", "REQ-008", "Tax Calculation Integration", 90, 20, "SPECIFIED"),
    makeEntry("r9", "REQ-009", "ERP Sync (NetSuite)", 85, 15, "SPECIFIED"),
    makeEntry("r10", "REQ-010", "Customer Address Book", 50, 10, "DEFINED"),
    makeEntry("r11", "REQ-011", "Quick Order Form", 45, 8, "DEFINED"),
    makeEntry("r12", "REQ-012", "B2B Account Hierarchy", 55, 65, "RISKY"),
    makeEntry("r13", "REQ-013", "Approval Workflow", 40, 70, "REVIEW"),
    makeEntry("r14", "REQ-014", "Invoice Management", 35, 72, "REVIEW"),
    makeEntry("r15", "REQ-015", "Credit Limit Enforcement", 10, 5, "BACKLOG"),
    makeEntry("r16", "REQ-016", "Shipping Estimation", 20, 55, "DANGER", true),
    makeEntry("r17", "REQ-017", "Returns & Refunds", 15, 60, "DANGER", true),
    makeEntry("r18", "REQ-018", "Abandoned Cart Recovery", 5, 80, "ROGUE", true),
  ],
};

const MOSTLY_READY_DATA = {
  totalRequirements: 8,
  warningCount: 0,
  summary: {
    READY: 6,
    IN_PROGRESS: 2,
    SPECIFIED: 0,
    DEFINED: 0,
    RISKY: 0,
    REVIEW: 0,
    BACKLOG: 0,
    DANGER: 0,
    ROGUE: 0,
  },
  entries: [
    makeEntry("r1", "REQ-001", "B2B Checkout Flow", 95, 90, "READY"),
    makeEntry("r2", "REQ-002", "Account Management Portal", 88, 85, "READY"),
    makeEntry("r3", "REQ-003", "Product Catalog Sync", 92, 78, "READY"),
    makeEntry("r4", "REQ-004", "Order Management API", 80, 72, "READY"),
    makeEntry("r5", "REQ-005", "Cart Persistence Service", 90, 88, "READY"),
    makeEntry("r6", "REQ-006", "Pricing Rules Engine", 85, 82, "READY"),
    makeEntry("r7", "REQ-007", "Promotion Engine", 70, 55, "IN_PROGRESS"),
    makeEntry("r8", "REQ-008", "Tax Calculation Integration", 68, 50, "IN_PROGRESS"),
  ],
};

const AT_RISK_DATA = {
  totalRequirements: 6,
  warningCount: 4,
  summary: {
    READY: 0,
    IN_PROGRESS: 1,
    SPECIFIED: 0,
    DEFINED: 1,
    RISKY: 1,
    REVIEW: 0,
    BACKLOG: 1,
    DANGER: 1,
    ROGUE: 1,
  },
  entries: [
    makeEntry("r1", "REQ-001", "B2B Checkout Flow", 68, 55, "IN_PROGRESS"),
    makeEntry("r2", "REQ-002", "Account Management Portal", 40, 10, "DEFINED"),
    makeEntry("r3", "REQ-003", "Product Catalog Sync", 55, 60, "RISKY"),
    makeEntry("r4", "REQ-004", "Order Management API", 5, 5, "BACKLOG"),
    makeEntry("r5", "REQ-005", "Cart Persistence Service", 20, 60, "DANGER", true),
    makeEntry("r6", "REQ-006", "Pricing Rules Engine", 5, 85, "ROGUE", true),
  ],
};

const meta: Meta<typeof ReadinessMatrix> = {
  title: "SourceControl/ReadinessMatrix",
  component: ReadinessMatrix,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog_acme_corp" as any,
  },
};

export default meta;
type Story = StoryObj<typeof ReadinessMatrix>;

export const FullMatrix: Story = {
  parameters: {
    convex: {
      "sourceControl.completeness.readinessMatrix.getForProgram": FULL_MATRIX_DATA,
    },
  },
};

export const MostlyReady: Story = {
  parameters: {
    convex: {
      "sourceControl.completeness.readinessMatrix.getForProgram": MOSTLY_READY_DATA,
    },
  },
};

export const AtRisk: Story = {
  parameters: {
    convex: {
      "sourceControl.completeness.readinessMatrix.getForProgram": AT_RISK_DATA,
    },
  },
};

export const EmptyState: Story = {
  parameters: {
    convex: {
      "sourceControl.completeness.readinessMatrix.getForProgram": {
        entries: [],
        totalRequirements: 0,
        warningCount: 0,
        summary: {},
      },
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.completeness.readinessMatrix.getForProgram": undefined,
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.completeness.readinessMatrix.getForProgram": FULL_MATRIX_DATA,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.completeness.readinessMatrix.getForProgram": FULL_MATRIX_DATA,
    },
  },
};
