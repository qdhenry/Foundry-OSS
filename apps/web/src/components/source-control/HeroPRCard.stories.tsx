import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { HeroPRCard } from "./HeroPRCard";

const BASE_PR = {
  _id: "pr_hero_001" as any,
  prNumber: 247,
  title: "feat(checkout): add stock validation before cart processing",
  state: "open",
  isDraft: false,
  sourceBranch: "feature/checkout-stock-validation",
  targetBranch: "main",
  providerUrl: "https://github.com/acme-corp/sf-b2b/pull/247",
  ciStatus: "passing",
  reviewState: "approved",
  hasConflicts: false,
  additions: 147,
  deletions: 52,
  filesChanged: 6,
  authorLogin: "alice-dev",
  mergedAt: null,
  body: "## Summary\n\nAdds stock validation step to the checkout flow to prevent orders on out-of-stock items.\n\n## Test plan\n- [ ] Unit tests for CartService.validateStock\n- [ ] Integration test for checkout with OOS items",
  reviews: [{ state: "APPROVED", reviewer: "bob-reviewer" }],
  commits: [],
};

const meta: Meta<typeof HeroPRCard> = {
  title: "SourceControl/HeroPRCard",
  component: HeroPRCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    taskId: "task_abc123" as any,
  },
};

export default meta;
type Story = StoryObj<typeof HeroPRCard>;

export const OpenApproved: Story = {
  name: "Open — Approved, CI Passing",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": BASE_PR,
    },
  },
};

export const OpenPendingReview: Story = {
  name: "Open — Review Pending",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": {
        ...BASE_PR,
        reviewState: "pending",
        ciStatus: "passing",
        reviews: [],
      },
    },
  },
};

export const OpenCIFailing: Story = {
  name: "Open — CI Failing",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": {
        ...BASE_PR,
        ciStatus: "failing",
        reviewState: "changes_requested",
        reviews: [{ state: "CHANGES_REQUESTED", reviewer: "bob-reviewer" }],
      },
    },
  },
};

export const OpenWithConflicts: Story = {
  name: "Open — Merge Conflicts",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": {
        ...BASE_PR,
        hasConflicts: true,
        ciStatus: "pending",
        reviewState: "none",
        reviews: [],
      },
    },
  },
};

export const DraftPR: Story = {
  name: "Draft PR",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": {
        ...BASE_PR,
        isDraft: true,
        reviewState: "none",
        ciStatus: "pending",
        reviews: [],
      },
    },
  },
};

export const MergedPR: Story = {
  name: "Merged",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": {
        ...BASE_PR,
        state: "merged",
        isDraft: false,
        mergedAt: Date.now() - 3_600_000,
        ciStatus: "passing",
        reviewState: "approved",
      },
    },
  },
};

export const ClosedPR: Story = {
  name: "Closed",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": {
        ...BASE_PR,
        state: "closed",
        isDraft: false,
        ciStatus: "none",
        reviewState: "none",
        reviews: [],
      },
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": undefined,
    },
  },
};

export const NoPR: Story = {
  name: "No Active PR (returns null)",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": null,
    },
  },
};

export const OpenMergeDropdown: Story = {
  name: "Open — Merge Dropdown Interaction",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": BASE_PR,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mergeBtn = canvas.getByRole("button", { name: /^merge$/i });
    await userEvent.click(mergeBtn);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": BASE_PR,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": {
        ...BASE_PR,
        ciStatus: "failing",
        reviewState: "changes_requested",
      },
    },
  },
};
