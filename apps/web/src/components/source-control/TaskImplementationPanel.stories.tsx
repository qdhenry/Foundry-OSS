import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { TaskImplementationPanel } from "./TaskImplementationPanel";

const NOW = Date.now();
const mins = (n: number) => NOW - n * 60_000;
const hours = (n: number) => NOW - n * 3_600_000;

const HERO_PR = {
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
  body: "## Summary\n\nAdds stock validation step to the checkout flow.",
  reviews: [{ state: "APPROVED", reviewer: "bob-reviewer" }],
  commits: [
    {
      sha: "a1b2c3d4e5f6789012345678901234567890abcd",
      message: "feat(checkout): add stock validation before cart processing",
      authorLogin: "alice-dev",
      authorName: "Alice Chen",
      timestamp: mins(45),
      url: "https://github.com/acme-corp/sf-b2b/commit/a1b2c3d",
      filesChanged: 4,
      additions: 87,
      deletions: 12,
    },
    {
      sha: "b2c3d4e5f6789012345678901234567890abcde",
      message: "refactor(cart): extract CartOptions interface",
      authorLogin: "alice-dev",
      authorName: "Alice Chen",
      timestamp: hours(2),
      url: "https://github.com/acme-corp/sf-b2b/commit/b2c3d4e",
      filesChanged: 2,
      additions: 28,
      deletions: 5,
    },
    {
      sha: "c3d4e5f6789012345678901234567890abcdef0",
      message: "test(checkout): add coverage for skipValidation",
      authorLogin: "alice-dev",
      authorName: "Alice Chen",
      timestamp: hours(3),
      url: "https://github.com/acme-corp/sf-b2b/commit/c3d4e5f",
      filesChanged: 1,
      additions: 32,
      deletions: 0,
    },
  ],
};

const DRAFT_HERO_PR = {
  ...HERO_PR,
  isDraft: true,
  reviewState: "none",
  ciStatus: "pending",
  reviews: [],
};

const MERGED_HERO_PR = {
  ...HERO_PR,
  state: "merged",
  mergedAt: hours(1),
};

const BRANCH_INFO = {
  branchName: "feature/checkout-stock-validation",
  repoFullName: "acme-corp/sf-b2b",
};

const ACTIVITY_EVENTS = [
  {
    _id: "event1",
    eventType: "pr_created",
    actorLogin: "alice-dev",
    occurredAt: hours(3),
    metadata: { prNumber: 247 },
  },
  {
    _id: "event2",
    eventType: "ci_passed",
    actorLogin: null,
    occurredAt: hours(2),
    metadata: {},
  },
  {
    _id: "event3",
    eventType: "review_submitted",
    actorLogin: "bob-reviewer",
    occurredAt: hours(1),
    metadata: { reviewer: "bob-reviewer" },
  },
];

const PREVIOUS_PRS = [
  {
    _id: "pr_prev_001",
    prNumber: 241,
    title: "feat(cart): extract CartOptions interface to shared types",
    state: "merged",
    isDraft: false,
    sourceBranch: "feature/cart-options-interface",
    targetBranch: "main",
    providerUrl: "https://github.com/acme-corp/sf-b2b/pull/241",
    commitCount: 2,
    filesChanged: 3,
    additions: 58,
    deletions: 14,
  },
];

const meta: Meta<typeof TaskImplementationPanel> = {
  title: "SourceControl/TaskImplementationPanel",
  component: TaskImplementationPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    taskId: "task_abc123" as any,
  },
};

export default meta;
type Story = StoryObj<typeof TaskImplementationPanel>;

export const ActivePR: Story = {
  name: "Active PR — Open, Approved",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": HERO_PR,
      "sourceControl.tasks.prLifecycle.getActivityFeed": ACTIVITY_EVENTS,
      "sourceControl.tasks.prLifecycle.getStackedPRs": [HERO_PR, ...PREVIOUS_PRS],
      "sandbox.sessions.getBranchInfoForTask": BRANCH_INFO,
    },
  },
};

export const DraftPR: Story = {
  name: "Active PR — Draft",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": DRAFT_HERO_PR,
      "sourceControl.tasks.prLifecycle.getActivityFeed": ACTIVITY_EVENTS.slice(0, 1),
      "sourceControl.tasks.prLifecycle.getStackedPRs": [DRAFT_HERO_PR],
      "sandbox.sessions.getBranchInfoForTask": BRANCH_INFO,
    },
  },
};

export const MergedPR: Story = {
  name: "Merged PR",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": MERGED_HERO_PR,
      "sourceControl.tasks.prLifecycle.getActivityFeed": [
        ...ACTIVITY_EVENTS,
        {
          _id: "event4",
          eventType: "pr_merged",
          actorLogin: "alice-dev",
          occurredAt: hours(1),
          metadata: { prNumber: 247 },
        },
      ],
      "sourceControl.tasks.prLifecycle.getStackedPRs": [MERGED_HERO_PR, ...PREVIOUS_PRS],
      "sandbox.sessions.getBranchInfoForTask": BRANCH_INFO,
    },
  },
};

export const NoPRBranchExists: Story = {
  name: "No PR — Branch Exists",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": null,
      "sourceControl.tasks.prLifecycle.getActivityFeed": [],
      "sourceControl.tasks.prLifecycle.getStackedPRs": [],
      "sandbox.sessions.getBranchInfoForTask": BRANCH_INFO,
    },
  },
};

export const NoPRNoBranch: Story = {
  name: "No PR — No Branch Yet",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": null,
      "sourceControl.tasks.prLifecycle.getActivityFeed": [],
      "sourceControl.tasks.prLifecycle.getStackedPRs": [],
      "sandbox.sessions.getBranchInfoForTask": null,
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": undefined,
      "sourceControl.tasks.prLifecycle.getActivityFeed": undefined,
      "sourceControl.tasks.prLifecycle.getStackedPRs": undefined,
      "sandbox.sessions.getBranchInfoForTask": undefined,
    },
  },
};

export const RefreshInteraction: Story = {
  name: "Active PR — Refresh Click",
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": HERO_PR,
      "sourceControl.tasks.prLifecycle.getActivityFeed": ACTIVITY_EVENTS,
      "sourceControl.tasks.prLifecycle.getStackedPRs": [HERO_PR],
      "sandbox.sessions.getBranchInfoForTask": BRANCH_INFO,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const refreshBtn = canvas.getByRole("button", { name: /^refresh$/i });
    await userEvent.click(refreshBtn);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": HERO_PR,
      "sourceControl.tasks.prLifecycle.getActivityFeed": ACTIVITY_EVENTS,
      "sourceControl.tasks.prLifecycle.getStackedPRs": [HERO_PR, ...PREVIOUS_PRS],
      "sandbox.sessions.getBranchInfoForTask": BRANCH_INFO,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.tasks.prLifecycle.getActiveHeroPR": HERO_PR,
      "sourceControl.tasks.prLifecycle.getActivityFeed": ACTIVITY_EVENTS,
      "sourceControl.tasks.prLifecycle.getStackedPRs": [HERO_PR, ...PREVIOUS_PRS],
      "sandbox.sessions.getBranchInfoForTask": BRANCH_INFO,
    },
  },
};
