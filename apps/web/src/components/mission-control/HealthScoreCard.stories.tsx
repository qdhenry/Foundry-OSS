import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { clearMockOverrides, setMockOverrides } from "../../../.storybook/mocks/convex";
import { HealthScoreCard } from "./HealthScoreCard";

// ─── Shared mock health score data ───────────────────────────────────────────

const mockScoreOnTrack = {
  _id: "hs-001" as any,
  _creationTime: Date.now(),
  health: "on_track",
  healthScore: 87,
  reasoning:
    "Product migration workstream is progressing steadily. Velocity is strong and no blocking issues detected across the last three sprints.",
  factors: {
    velocityScore: 90,
    taskAgingScore: 82,
    riskScore: 88,
    gatePassRate: 95,
    dependencyScore: 80,
  },
  changeReason: null,
};

const mockScoreAtRisk = {
  _id: "hs-002" as any,
  _creationTime: Date.now(),
  health: "at_risk",
  healthScore: 56,
  reasoning:
    "Three tasks are aging past their SLA thresholds. API rate limiting risks remain unmitigated and could delay the upcoming sprint gate.",
  factors: {
    velocityScore: 48,
    taskAgingScore: 42,
    riskScore: 60,
    gatePassRate: 70,
    dependencyScore: 60,
  },
  changeReason: "Velocity dropped 18% compared to previous sprint due to two blocked tasks.",
};

const mockScoreBlocked = {
  _id: "hs-003" as any,
  _creationTime: Date.now(),
  health: "blocked",
  healthScore: 22,
  reasoning:
    "Critical dependency on upstream data export has not been resolved. All active tasks are halted pending external API access from the client.",
  factors: {
    velocityScore: 10,
    taskAgingScore: 15,
    riskScore: 30,
    gatePassRate: 40,
    dependencyScore: 12,
  },
  changeReason: "External API credentials expired on 2026-02-18. Escalation in progress.",
};

const mockScorePerfect = {
  _id: "hs-004" as any,
  _creationTime: Date.now(),
  health: "on_track",
  healthScore: 100,
  reasoning: "All requirements delivered. Zero open risks. Sprint gate passed with full approval.",
  factors: {
    velocityScore: 100,
    taskAgingScore: 100,
    riskScore: 100,
    gatePassRate: 100,
    dependencyScore: 100,
  },
  changeReason: null,
};

// ─── Decorator helpers ────────────────────────────────────────────────────────

type MockHealthScore = {
  _id: any;
  _creationTime: number;
  health: string;
  healthScore: number;
  reasoning: string;
  factors: Record<string, number>;
  changeReason: string | null;
};

function withHealthScore(score: MockHealthScore | null | undefined) {
  return (Story: React.ComponentType) => {
    if (score === undefined) {
      clearMockOverrides();
    } else {
      setMockOverrides({ "healthScoring:getLatestHealthScore": score });
    }
    return <Story />;
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof HealthScoreCard> = {
  title: "MissionControl/HealthScoreCard",
  component: HealthScoreCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    workstreamId: { control: "text" },
    workstreamName: { control: "text" },
  },
  args: {
    workstreamId: "ws-1" as any,
    workstreamName: "Product Data Migration",
  },
};

export default meta;
type Story = StoryObj<typeof HealthScoreCard>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "On Track",
  decorators: [withHealthScore(mockScoreOnTrack)],
};

export const AtRisk: Story = {
  name: "At Risk",
  args: {
    workstreamName: "Order History Transfer",
  },
  decorators: [withHealthScore(mockScoreAtRisk)],
};

export const Blocked: Story = {
  name: "Blocked",
  args: {
    workstreamName: "Customer Accounts",
  },
  decorators: [withHealthScore(mockScoreBlocked)],
};

export const PerfectScore: Story = {
  name: "Perfect Score (100/100)",
  args: {
    workstreamName: "Storefront Theme & UX",
  },
  decorators: [withHealthScore(mockScorePerfect)],
};

export const WithChangeReason: Story = {
  name: "With Change Reason",
  args: {
    workstreamName: "API Integration",
  },
  decorators: [withHealthScore(mockScoreAtRisk)],
};

export const NoHealthData: Story = {
  name: "Empty (No Health Data)",
  decorators: [withHealthScore(null)],
};

export const Loading: Story = {
  name: "Loading State",
  // undefined return from useQuery triggers the loading skeleton
  decorators: [withHealthScore(undefined)],
};

export const Mobile: Story = {
  name: "Mobile",
  decorators: [withHealthScore(mockScoreAtRisk)],
  args: {
    workstreamName: "Order History Transfer",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet",
  decorators: [withHealthScore(mockScoreOnTrack)],
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
