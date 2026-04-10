import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { BranchStrategyPanel } from "./BranchStrategyPanel";

const FEATURE_BRANCHES_STRATEGY = {
  branchStrategy: {
    strategy_type: "feature_branches",
    rationale:
      "Given the high degree of module independence across the 7 workstreams, feature branches offer the cleanest isolation. Each task maps to a single branch that merges via squash, keeping the integration branch green.",
    recommended_branches: [
      {
        branch_name: "feature/checkout-flow-overhaul",
        purpose: "Rebuild checkout sequence to align with Salesforce B2B Commerce Cart API",
        parent_branch: "main",
        workstreams: ["Checkout & Cart"],
        tasks: ["TASK-112", "TASK-113"],
        merge_timing: "End of Sprint 3",
      },
      {
        branch_name: "feature/product-catalog-sync",
        purpose: "Implement real-time product catalog synchronisation from PIM source",
        parent_branch: "main",
        workstreams: ["Catalog Management"],
        tasks: ["TASK-087", "TASK-088", "TASK-089"],
        merge_timing: "End of Sprint 2",
      },
      {
        branch_name: "feature/order-management-api",
        purpose: "Order lifecycle API endpoints for B2B order management portal",
        parent_branch: "main",
        workstreams: ["Order Management"],
        tasks: ["TASK-201", "TASK-202"],
        merge_timing: "End of Sprint 3",
      },
    ],
    overlap_warnings: [
      {
        file_or_module: "src/commerce/cart/CartService.ts",
        workstreams: ["Checkout & Cart", "Order Management"],
        conflict_risk: "high",
        recommendation:
          "Coordinate merge order: merge Order Management branch first, then rebase Checkout flow on top to resolve upstream changes.",
      },
      {
        file_or_module: "src/integrations/erp/NetSuiteAdapter.ts",
        workstreams: ["Catalog Management", "Order Management"],
        conflict_risk: "medium",
        recommendation:
          "Both workstreams touch the ERP adapter interface. Schedule a sync meeting to agree on the shared interface contract before implementation starts.",
      },
    ],
    merge_order: [
      {
        branch: "feature/product-catalog-sync",
        merge_into: "main",
        order: 1,
        rationale: "No upstream dependencies — can merge independently once CI is green.",
      },
      {
        branch: "feature/order-management-api",
        merge_into: "main",
        order: 2,
        rationale: "Depends on catalog data model. Must follow catalog sync merge.",
      },
      {
        branch: "feature/checkout-flow-overhaul",
        merge_into: "main",
        order: 3,
        rationale: "Requires order management API contract to be stable before integration.",
      },
    ],
  },
};

const TRUNK_BASED_STRATEGY = {
  branchStrategy: {
    strategy_type: "trunk_based",
    rationale:
      "The team practices continuous integration with daily deployments. Short-lived feature flags and trunk-based development reduce merge friction and surface integration issues earlier.",
    recommended_branches: [
      {
        branch_name: "trunk",
        purpose: "Main integration branch — all changes land here daily",
        parent_branch: "main",
        workstreams: ["All"],
        tasks: [],
        merge_timing: "Daily",
      },
    ],
    overlap_warnings: [],
    merge_order: [],
  },
};

const WORKSTREAM_STRATEGY = {
  branchStrategy: {
    strategy_type: "workstream_branches",
    rationale:
      "Seven workstreams with significant cross-team coordination. Workstream branches give team leads visibility and control over when each stream integrates.",
    recommended_branches: [
      {
        branch_name: "ws/checkout-and-cart",
        purpose: "Aggregates all checkout feature branches for the sprint",
        parent_branch: "integration",
        workstreams: ["Checkout & Cart"],
        tasks: ["TASK-112", "TASK-113", "TASK-114"],
        merge_timing: "Sprint end — after QA sign-off",
      },
    ],
    overlap_warnings: [
      {
        file_or_module: "force-app/main/default/classes/B2BCartController.cls",
        workstreams: ["Checkout & Cart", "Account Management"],
        conflict_risk: "low",
        recommendation: "Low overlap — review diff at merge time.",
      },
    ],
    merge_order: [
      {
        branch: "ws/checkout-and-cart",
        merge_into: "integration",
        order: 1,
        rationale: "Highest business priority — ship checkout first.",
      },
    ],
  },
};

const meta: Meta<typeof BranchStrategyPanel> = {
  title: "SourceControl/BranchStrategyPanel",
  component: BranchStrategyPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    sprintId: "sprint_abc123" as any,
    programId: "prog_xyz789" as any,
  },
};

export default meta;
type Story = StoryObj<typeof BranchStrategyPanel>;

export const FeatureBranches: Story = {
  parameters: {
    convex: {
      "sourceControl.branching.strategyRecommendation.getStrategyForSprint":
        FEATURE_BRANCHES_STRATEGY,
    },
  },
};

export const TrunkBased: Story = {
  parameters: {
    convex: {
      "sourceControl.branching.strategyRecommendation.getStrategyForSprint": TRUNK_BASED_STRATEGY,
    },
  },
};

export const WorkstreamBranches: Story = {
  parameters: {
    convex: {
      "sourceControl.branching.strategyRecommendation.getStrategyForSprint": WORKSTREAM_STRATEGY,
    },
  },
};

export const EmptyState: Story = {
  parameters: {
    convex: {
      "sourceControl.branching.strategyRecommendation.getStrategyForSprint": null,
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.branching.strategyRecommendation.getStrategyForSprint": undefined,
    },
  },
};

export const RefreshInteraction: Story = {
  parameters: {
    convex: {
      "sourceControl.branching.strategyRecommendation.getStrategyForSprint":
        FEATURE_BRANCHES_STRATEGY,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const refreshBtn = canvas.getByRole("button", { name: /refresh/i });
    await userEvent.click(refreshBtn);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.branching.strategyRecommendation.getStrategyForSprint":
        FEATURE_BRANCHES_STRATEGY,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.branching.strategyRecommendation.getStrategyForSprint":
        FEATURE_BRANCHES_STRATEGY,
    },
  },
};
