import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CodeHealthSection } from "./CodeHealthSection";

const meta: Meta<typeof CodeHealthSection> = {
  title: "SourceControl/CodeHealthSection",
  component: CodeHealthSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog_acme_corp" as any,
  },
};

export default meta;
type Story = StoryObj<typeof CodeHealthSection>;

const HEALTHY_DATA = {
  repoCount: 3,
  commitCount7d: 47,
  prsMerged7d: 9,
  prsAwaitingReview: 1,
  ciPassRate: 94,
  compositeScore: 88,
  singleAuthorWarning: false,
};

const DEGRADED_DATA = {
  repoCount: 2,
  commitCount7d: 12,
  prsMerged7d: 2,
  prsAwaitingReview: 6,
  ciPassRate: 58,
  compositeScore: 52,
  singleAuthorWarning: true,
};

const CRITICAL_DATA = {
  repoCount: 1,
  commitCount7d: 3,
  prsMerged7d: 0,
  prsAwaitingReview: 11,
  ciPassRate: 22,
  compositeScore: 24,
  singleAuthorWarning: true,
};

const IDLE_DATA = {
  repoCount: 2,
  commitCount7d: 0,
  prsMerged7d: 0,
  prsAwaitingReview: 0,
  ciPassRate: 100,
  compositeScore: 65,
  singleAuthorWarning: false,
};

export const Healthy: Story = {
  parameters: {
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": HEALTHY_DATA,
    },
  },
};

export const Degraded: Story = {
  parameters: {
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": DEGRADED_DATA,
    },
  },
};

export const Critical: Story = {
  parameters: {
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": CRITICAL_DATA,
    },
  },
};

export const IdleWeek: Story = {
  name: "Idle Week (no commits)",
  parameters: {
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": IDLE_DATA,
    },
  },
};

export const NoReposConnected: Story = {
  parameters: {
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": { repoCount: 0 },
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": undefined,
    },
  },
};

export const SingleAuthorWarning: Story = {
  parameters: {
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": DEGRADED_DATA,
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": HEALTHY_DATA,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.health.codeHealthSignals.getForProgram": DEGRADED_DATA,
    },
  },
};
