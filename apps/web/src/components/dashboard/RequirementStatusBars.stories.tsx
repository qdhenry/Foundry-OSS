import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RequirementStatusBars } from "./RequirementStatusBars";

const meta: Meta<typeof RequirementStatusBars> = {
  title: "Dashboard/RequirementStatusBars",
  component: RequirementStatusBars,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    statusCounts: {
      description: "Requirement counts broken down by workflow status",
    },
    priorityCounts: {
      description: "Requirement counts broken down by priority tier",
    },
  },
};

export default meta;
type Story = StoryObj<typeof RequirementStatusBars>;

export const Default: Story = {
  args: {
    statusCounts: {
      draft: 12,
      approved: 28,
      in_progress: 31,
      complete: 42,
      deferred: 5,
      total: 118,
    },
    priorityCounts: {
      must_have: 54,
      should_have: 38,
      nice_to_have: 21,
      deferred: 5,
      total: 118,
    },
  },
};

export const EarlyStage: Story = {
  name: "Early Stage (mostly draft)",
  args: {
    statusCounts: {
      draft: 95,
      approved: 14,
      in_progress: 6,
      complete: 3,
      deferred: 0,
      total: 118,
    },
    priorityCounts: {
      must_have: 60,
      should_have: 40,
      nice_to_have: 18,
      deferred: 0,
      total: 118,
    },
  },
};

export const MidDelivery: Story = {
  name: "Mid Delivery (active sprint)",
  args: {
    statusCounts: {
      draft: 5,
      approved: 18,
      in_progress: 52,
      complete: 38,
      deferred: 5,
      total: 118,
    },
    priorityCounts: {
      must_have: 54,
      should_have: 38,
      nice_to_have: 21,
      deferred: 5,
      total: 118,
    },
  },
};

export const NearComplete: Story = {
  name: "Near Complete (90%+)",
  args: {
    statusCounts: {
      draft: 0,
      approved: 0,
      in_progress: 8,
      complete: 104,
      deferred: 6,
      total: 118,
    },
    priorityCounts: {
      must_have: 54,
      should_have: 38,
      nice_to_have: 14,
      deferred: 12,
      total: 118,
    },
  },
};

export const FullyComplete: Story = {
  name: "Fully Complete",
  args: {
    statusCounts: {
      draft: 0,
      approved: 0,
      in_progress: 0,
      complete: 112,
      deferred: 6,
      total: 118,
    },
    priorityCounts: {
      must_have: 54,
      should_have: 38,
      nice_to_have: 21,
      deferred: 5,
      total: 118,
    },
  },
};

export const HeavilyDeferred: Story = {
  name: "Heavily Deferred",
  args: {
    statusCounts: {
      draft: 8,
      approved: 10,
      in_progress: 20,
      complete: 45,
      deferred: 35,
      total: 118,
    },
    priorityCounts: {
      must_have: 40,
      should_have: 30,
      nice_to_have: 13,
      deferred: 35,
      total: 118,
    },
  },
};

export const UndefinedData: Story = {
  name: "Loading / Undefined Data",
  args: {
    statusCounts: undefined,
    priorityCounts: undefined,
  },
};

export const EmptyTotals: Story = {
  name: "Zero Totals",
  args: {
    statusCounts: {
      draft: 0,
      approved: 0,
      in_progress: 0,
      complete: 0,
      deferred: 0,
      total: 0,
    },
    priorityCounts: {
      must_have: 0,
      should_have: 0,
      nice_to_have: 0,
      deferred: 0,
      total: 0,
    },
  },
};

export const OnlyMustHave: Story = {
  name: "All Must-Have Priority",
  args: {
    statusCounts: {
      draft: 10,
      approved: 30,
      in_progress: 40,
      complete: 38,
      deferred: 0,
      total: 118,
    },
    priorityCounts: {
      must_have: 118,
      should_have: 0,
      nice_to_have: 0,
      deferred: 0,
      total: 118,
    },
  },
};

export const Mobile: Story = {
  args: {
    statusCounts: {
      draft: 12,
      approved: 28,
      in_progress: 31,
      complete: 42,
      deferred: 5,
      total: 118,
    },
    priorityCounts: {
      must_have: 54,
      should_have: 38,
      nice_to_have: 21,
      deferred: 5,
      total: 118,
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const Tablet: Story = {
  args: {
    statusCounts: {
      draft: 12,
      approved: 28,
      in_progress: 31,
      complete: 42,
      deferred: 5,
      total: 118,
    },
    priorityCounts: {
      must_have: 54,
      should_have: 38,
      nice_to_have: 21,
      deferred: 5,
      total: 118,
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
