import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { ActivityFeedSection } from "./ActivityFeedSection";

// useQuery is globally mocked — no decorator needed

const NOW = Date.now();
const mins = (n: number) => NOW - n * 60_000;
const hours = (n: number) => NOW - n * 3_600_000;
const days = (n: number) => NOW - n * 86_400_000;

const MOCK_EVENTS = [
  {
    _id: "event1",
    eventType: "pr_created",
    actorLogin: "alice-dev",
    occurredAt: mins(5),
    metadata: { prNumber: 247 },
  },
  {
    _id: "event2",
    eventType: "review_requested",
    actorLogin: "alice-dev",
    occurredAt: mins(4),
    metadata: { reviewer: "bob-reviewer" },
  },
  {
    _id: "event3",
    eventType: "ci_pending",
    actorLogin: null,
    occurredAt: mins(3),
    metadata: {},
  },
  {
    _id: "event4",
    eventType: "ci_passed",
    actorLogin: null,
    occurredAt: mins(2),
    metadata: {},
  },
  {
    _id: "event5",
    eventType: "review_submitted",
    actorLogin: "bob-reviewer",
    occurredAt: mins(1),
    metadata: { reviewer: "bob-reviewer" },
  },
  {
    _id: "event6",
    eventType: "pr_merged",
    actorLogin: "alice-dev",
    occurredAt: mins(0.5),
    metadata: { prNumber: 247 },
  },
];

const CONFLICT_EVENTS = [
  {
    _id: "ev1",
    eventType: "commits_pushed",
    actorLogin: "carol-eng",
    occurredAt: hours(2),
    metadata: { commitCount: 3 },
  },
  {
    _id: "ev2",
    eventType: "conflict_detected",
    actorLogin: null,
    occurredAt: hours(1),
    metadata: {},
  },
  {
    _id: "ev3",
    eventType: "conflict_resolved",
    actorLogin: "carol-eng",
    occurredAt: mins(30),
    metadata: {},
  },
];

const OLDER_EVENTS = [
  {
    _id: "old1",
    eventType: "pr_created",
    actorLogin: "dave-lead",
    occurredAt: days(3),
    metadata: { prNumber: 198 },
  },
  {
    _id: "old2",
    eventType: "pr_closed",
    actorLogin: "dave-lead",
    occurredAt: days(2),
    metadata: { prNumber: 198 },
  },
  {
    _id: "old3",
    eventType: "task_status_changed",
    actorLogin: "pm-user",
    occurredAt: days(1),
    metadata: { newStatus: "in_review" },
  },
];

// Override the Convex mock for each story via parameters
const meta: Meta<typeof ActivityFeedSection> = {
  title: "SourceControl/ActivityFeedSection",
  component: ActivityFeedSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    taskId: "task_abc123" as any,
  },
};

export default meta;
type Story = StoryObj<typeof ActivityFeedSection>;

export const Default: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActivityFeed": MOCK_EVENTS,
    },
  },
};

export const ConflictResolution: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActivityFeed": CONFLICT_EVENTS,
    },
  },
};

export const OlderActivity: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActivityFeed": OLDER_EVENTS,
    },
  },
};

export const EmptyState: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActivityFeed": [],
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActivityFeed": undefined,
    },
  },
};

export const CollapsedByDefault: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prLifecycle.getActivityFeed": MOCK_EVENTS,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click to collapse the feed
    const header = canvas.getByRole("button", { name: /activity feed/i });
    await userEvent.click(header);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.tasks.prLifecycle.getActivityFeed": MOCK_EVENTS,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.tasks.prLifecycle.getActivityFeed": MOCK_EVENTS,
    },
  },
};
