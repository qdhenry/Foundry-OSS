import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { PreviousPRsSection } from "./PreviousPRsSection";

const NOW = Date.now();
const _days = (n: number) => NOW - n * 86_400_000;

const ALL_PRS = [
  {
    _id: "pr_active_001",
    prNumber: 247,
    title: "feat(checkout): add stock validation before cart processing",
    state: "open",
    isDraft: false,
    sourceBranch: "feature/checkout-stock-validation",
    targetBranch: "main",
    providerUrl: "https://github.com/acme-corp/sf-b2b/pull/247",
    commitCount: 3,
    filesChanged: 6,
    additions: 147,
    deletions: 52,
  },
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
  {
    _id: "pr_prev_002",
    prNumber: 235,
    title: "refactor(checkout): remove deprecated OldCheckout module",
    state: "merged",
    isDraft: false,
    sourceBranch: "chore/remove-legacy-checkout",
    targetBranch: "main",
    providerUrl: "https://github.com/acme-corp/sf-b2b/pull/235",
    commitCount: 1,
    filesChanged: 1,
    additions: 0,
    deletions: 156,
  },
  {
    _id: "pr_prev_003",
    prNumber: 228,
    title: "fix(cart): correct CartController rename",
    state: "closed",
    isDraft: false,
    sourceBranch: "fix/cart-controller-rename",
    targetBranch: "main",
    providerUrl: "https://github.com/acme-corp/sf-b2b/pull/228",
    commitCount: 1,
    filesChanged: 1,
    additions: 5,
    deletions: 5,
  },
];

const meta: Meta<typeof PreviousPRsSection> = {
  title: "SourceControl/PreviousPRsSection",
  component: PreviousPRsSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    taskId: "task_abc123" as any,
    activePrId: "pr_active_001" as any,
  },
};

export default meta;
type Story = StoryObj<typeof PreviousPRsSection>;

export const WithPreviousPRs: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getStackedPRs": ALL_PRS,
    },
  },
};

export const ExpandedRow: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getStackedPRs": ALL_PRS,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Expand the first PR row
    const rows = canvas.getAllByRole("button");
    // First button is the section header, second is the first PR row
    if (rows.length > 1) {
      await userEvent.click(rows[1]);
    }
  },
};

export const SinglePreviousPR: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getStackedPRs": [ALL_PRS[0], ALL_PRS[1]],
    },
  },
};

export const OnlyClosedPRs: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getStackedPRs": [ALL_PRS[0], ALL_PRS[3]],
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getStackedPRs": undefined,
    },
  },
};

export const CollapsedSection: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getStackedPRs": ALL_PRS,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("button", { name: /previous prs/i });
    await userEvent.click(header);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.tasks.prLifecycle.getStackedPRs": ALL_PRS,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.tasks.prLifecycle.getStackedPRs": ALL_PRS,
    },
  },
};
