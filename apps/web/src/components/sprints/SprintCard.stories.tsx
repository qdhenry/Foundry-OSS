import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SprintCard } from "./SprintCard";

const meta: Meta<typeof SprintCard> = {
  title: "Sprints/SprintCard",
  component: SprintCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    sprint: { control: "object" },
    programId: { control: "text" },
    workstreamName: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof SprintCard>;

const baseSprint = {
  _id: "sprint_abc123",
  name: "Sprint 3 — Checkout & Payments",
  number: 3,
  workstreamId: "ws_001",
  startDate: new Date("2026-02-10").getTime(),
  endDate: new Date("2026-02-24").getTime(),
  goal: "Complete the storefront checkout flow including cart persistence, address validation, Stripe payment processing, and order confirmation emails.",
};

export const Active: Story = {
  args: {
    sprint: { ...baseSprint, status: "active" },
    programId: "prog_acme",
    workstreamName: "Commerce",
  },
};

export const Planning: Story = {
  args: {
    sprint: {
      ...baseSprint,
      _id: "sprint_plan001",
      name: "Sprint 4 — Account Management",
      number: 4,
      status: "planning",
      startDate: new Date("2026-03-01").getTime(),
      endDate: new Date("2026-03-14").getTime(),
      goal: "Build B2B account management: company profiles, purchase limits, approval workflows, and user role management.",
    },
    programId: "prog_acme",
    workstreamName: "Commerce",
  },
};

export const Completed: Story = {
  args: {
    sprint: {
      ...baseSprint,
      _id: "sprint_done001",
      name: "Sprint 1 — Foundation & Auth",
      number: 1,
      status: "completed",
      startDate: new Date("2026-01-06").getTime(),
      endDate: new Date("2026-01-17").getTime(),
      goal: "Establish project scaffolding, Clerk authentication, Convex schema, and CI/CD pipeline.",
    },
    programId: "prog_acme",
    workstreamName: "Platform",
  },
};

export const Cancelled: Story = {
  args: {
    sprint: {
      ...baseSprint,
      _id: "sprint_cancel001",
      name: "Sprint 2 — Native Mobile",
      number: 2,
      status: "cancelled",
      startDate: new Date("2026-01-20").getTime(),
      endDate: new Date("2026-01-31").getTime(),
      goal: "Build React Native companion app for field sales team.",
    },
    programId: "prog_acme",
    workstreamName: "Mobile",
  },
};

export const NoDates: Story = {
  args: {
    sprint: {
      _id: "sprint_nodates",
      name: "Sprint 5 — Integrations",
      number: 5,
      status: "planning",
      workstreamId: "ws_002",
      goal: "Integrate with ERP, tax calculation service, and shipping providers.",
    },
    programId: "prog_acme",
    workstreamName: "Integrations",
  },
};

export const NoGoal: Story = {
  args: {
    sprint: {
      _id: "sprint_nogoal",
      name: "Sprint 6 — Performance",
      number: 6,
      status: "planning",
      workstreamId: "ws_003",
      startDate: new Date("2026-03-15").getTime(),
      endDate: new Date("2026-03-28").getTime(),
    },
    programId: "prog_acme",
  },
};

export const NoWorkstreamName: Story = {
  args: {
    sprint: {
      ...baseSprint,
      status: "active",
    },
    programId: "prog_acme",
  },
};

export const LongTitle: Story = {
  args: {
    sprint: {
      _id: "sprint_long",
      name: "Sprint 7 — Advanced B2B Catalog Management and Pricing Configuration",
      number: 7,
      status: "active",
      workstreamId: "ws_004",
      startDate: new Date("2026-04-01").getTime(),
      endDate: new Date("2026-04-14").getTime(),
      goal: "Implement tiered pricing, contract pricing, customer-specific catalogs, and bulk order discounts.",
    },
    programId: "prog_acme",
    workstreamName: "Catalog",
  },
};

export const Mobile: Story = {
  args: {
    sprint: { ...baseSprint, status: "active" },
    programId: "prog_acme",
    workstreamName: "Commerce",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    sprint: { ...baseSprint, status: "active" },
    programId: "prog_acme",
    workstreamName: "Commerce",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
