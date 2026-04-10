import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { clearMockOverrides, setMockOverrides } from "../../../.storybook/mocks/convex";
import { DailyDigest } from "./DailyDigest";

const NOW = Date.now();
const hoursAgo = (h: number) => NOW - h * 60 * 60 * 1000;

// ─── Mock digest query results ────────────────────────────────────────────────

const cachedDigestResult = {
  source: "cache" as const,
  digest:
    "Since your last visit 4 hours ago, the AcmeCorp migration has seen meaningful progress. Product Data Migration completed 3 new requirements, bringing the workstream to 58% overall completion. Order History Transfer flagged a new API rate-limiting risk that requires attention before the Sprint 3 gate. Customer Accounts remains on track with no blockers. Two agent executions completed successfully, generating schema migration scripts for the Salesforce B2B data model.",
  metadata: {
    changeCount: 14,
    workstreamsAffected: 3,
  },
};

const generateDigestResult = {
  source: "generate" as const,
  digest: null,
  context: {
    orgId: "org_foundry_demo",
    programId: "prog-acme-demo" as any,
    userId: "user-1",
    lastVisitTime: hoursAgo(24),
    changesSummary: {},
    workstreamSummary: {},
    taskSummary: {},
  },
};

const noChangesDigestResult = {
  source: "cache" as const,
  digest: "No significant changes since your last visit. All workstreams are on track.",
  metadata: {
    changeCount: 0,
    workstreamsAffected: 0,
  },
};

// ─── Decorator helpers ────────────────────────────────────────────────────────

function withDigestQuery(result: unknown) {
  return (Story: React.ComponentType) => {
    setMockOverrides({ "missionControl:getDailyDigest": result });
    return <Story />;
  };
}

function withNoDigestQuery() {
  return (Story: React.ComponentType) => {
    clearMockOverrides();
    return <Story />;
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof DailyDigest> = {
  title: "MissionControl/DailyDigest",
  component: DailyDigest,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    programId: { control: "text" },
    lastVisitTime: { control: "number" },
  },
  args: {
    programId: "prog-acme-demo" as any,
    lastVisitTime: hoursAgo(4),
  },
};

export default meta;
type Story = StoryObj<typeof DailyDigest>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Cached Digest",
  decorators: [withDigestQuery(cachedDigestResult)],
};

export const WithMetadata: Story = {
  name: "Cached with Change Metadata",
  decorators: [withDigestQuery(cachedDigestResult)],
  args: {
    lastVisitTime: hoursAgo(8),
  },
};

export const NoChanges: Story = {
  name: "No Changes Since Last Visit",
  decorators: [withDigestQuery(noChangesDigestResult)],
  args: {
    lastVisitTime: hoursAgo(1),
  },
};

export const Loading: Story = {
  name: "Loading / Query Pending",
  // null return from useQuery renders the loading skeleton
  decorators: [withNoDigestQuery()],
};

export const GeneratingDigest: Story = {
  name: "Generating (source: generate)",
  // The generate path triggers the action which is mocked — the component
  // will attempt to call the mocked action and show the loading indicator
  // briefly before the mock resolves. The useAction mock returns a stub fn.
  decorators: [withDigestQuery(generateDigestResult)],
  args: {
    lastVisitTime: hoursAgo(24),
  },
};

export const LongDigest: Story = {
  name: "Long Digest Text",
  decorators: [
    withDigestQuery({
      ...cachedDigestResult,
      digest:
        "Over the past 12 hours, the AcmeCorp migration platform recorded 31 distinct changes across all 7 workstreams. Product Data Migration is the most active workstream: 6 requirements moved to complete, 2 agent executions ran successfully generating Salesforce B2B data model schemas, and 1 new risk was logged around SKU attribute mapping edge cases. Order History Transfer has 4 tasks aging past their 5-day SLA threshold — immediate attention is recommended before the Sprint 3 gate review scheduled for Friday. Customer Accounts completed the Clerk organization sync implementation and is now 72% complete. BigCommerce B2B Configuration and Custom Pricing Engine remain in early-sprint planning mode with no blocking issues. The AI health scoring system flagged Order History Transfer as 'at risk' with a score of 56, down from 74 in the previous cycle. Two sprint gate approvals are pending sign-off from the Engineering Lead and Product Manager.",
      metadata: {
        changeCount: 31,
        workstreamsAffected: 7,
      },
    }),
  ],
};

export const RecentVisit: Story = {
  name: "Recent Visit (Under 1 Hour)",
  decorators: [withDigestQuery(noChangesDigestResult)],
  args: {
    lastVisitTime: hoursAgo(0.5),
  },
};

export const Mobile: Story = {
  name: "Mobile",
  decorators: [withDigestQuery(cachedDigestResult)],
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet",
  decorators: [withDigestQuery(cachedDigestResult)],
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
