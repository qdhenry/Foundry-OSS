import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkstreamGrid } from "./WorkstreamGrid";

// WorkstreamGrid uses useQuery(api.workstreamDependencies.listByProgram) internally.
// The global Convex mock returns an empty array by default, which renders all
// workstream cards without dependency counts. Stories that need dependency counts
// should pass workstreams with depCount context baked in via the mock override
// at the preview level, or simply document the dependency-badge behaviour via
// the story description.

const PROGRAM_ID = "prog_acme_corp" as any;

const allWorkstreams = [
  {
    _id: "ws_001" as any,
    name: "Salesforce B2B Commerce Setup",
    shortCode: "SFC-SETUP",
    status: "on_track" as const,
    currentSprint: 3,
  },
  {
    _id: "ws_002" as any,
    name: "Magento Data Migration",
    shortCode: "MAG-MIGR",
    status: "at_risk" as const,
    currentSprint: 2,
  },
  {
    _id: "ws_003" as any,
    name: "BigCommerce B2B Configuration",
    shortCode: "BC-B2B",
    status: "on_track" as const,
    currentSprint: 4,
  },
  {
    _id: "ws_004" as any,
    name: "Customer Account Hierarchy",
    shortCode: "ACCT-HIER",
    status: "blocked" as const,
    currentSprint: 1,
  },
  {
    _id: "ws_005" as any,
    name: "Order Management Integration",
    shortCode: "ORD-INT",
    status: "on_track" as const,
    currentSprint: 3,
  },
  {
    _id: "ws_006" as any,
    name: "Custom Pricing Engine",
    shortCode: "PRICE-ENG",
    status: "at_risk" as const,
    currentSprint: 2,
  },
  {
    _id: "ws_007" as any,
    name: "Storefront Theme & UX",
    shortCode: "THEME-UX",
    status: "on_track" as const,
    currentSprint: 5,
  },
];

const meta: Meta<typeof WorkstreamGrid> = {
  title: "Dashboard/WorkstreamGrid",
  component: WorkstreamGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    nextjs: {
      navigation: {
        pathname: "/prog_acme_corp/workstreams",
        query: {},
      },
    },
  },
  argTypes: {
    workstreams: {
      description: "Array of workstream records to render as cards",
    },
    programId: {
      description: "ID of the parent program (used for link hrefs and dependency query)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkstreamGrid>;

export const Default: Story = {
  args: {
    workstreams: allWorkstreams,
    programId: PROGRAM_ID,
  },
};

export const AllOnTrack: Story = {
  name: "All On Track",
  args: {
    workstreams: allWorkstreams.map((ws) => ({ ...ws, status: "on_track" as const })),
    programId: PROGRAM_ID,
  },
};

export const AllAtRisk: Story = {
  name: "All At Risk",
  args: {
    workstreams: allWorkstreams.map((ws) => ({ ...ws, status: "at_risk" as const })),
    programId: PROGRAM_ID,
  },
};

export const AllBlocked: Story = {
  name: "All Blocked",
  args: {
    workstreams: allWorkstreams.map((ws) => ({ ...ws, status: "blocked" as const })),
    programId: PROGRAM_ID,
  },
};

export const MixedStatuses: Story = {
  name: "Mixed Statuses",
  args: {
    workstreams: [
      { ...allWorkstreams[0], status: "on_track" as const },
      { ...allWorkstreams[1], status: "at_risk" as const },
      { ...allWorkstreams[2], status: "blocked" as const },
      { ...allWorkstreams[3], status: "on_track" as const },
    ],
    programId: PROGRAM_ID,
  },
};

export const WithoutCurrentSprint: Story = {
  name: "Without Current Sprint",
  args: {
    workstreams: allWorkstreams.map(({ currentSprint: _sprint, ...ws }) => ws),
    programId: PROGRAM_ID,
  },
};

export const SingleWorkstream: Story = {
  name: "Single Workstream",
  args: {
    workstreams: [allWorkstreams[0]],
    programId: PROGRAM_ID,
  },
};

export const TwoWorkstreams: Story = {
  name: "Two Workstreams",
  args: {
    workstreams: allWorkstreams.slice(0, 2),
    programId: PROGRAM_ID,
  },
};

export const Empty: Story = {
  args: {
    workstreams: [],
    programId: PROGRAM_ID,
  },
};

export const HighSprintNumbers: Story = {
  name: "High Sprint Numbers",
  args: {
    workstreams: allWorkstreams.map((ws, i) => ({ ...ws, currentSprint: 10 + i })),
    programId: PROGRAM_ID,
  },
};

export const Mobile: Story = {
  args: {
    workstreams: allWorkstreams,
    programId: PROGRAM_ID,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    nextjs: {
      navigation: {
        pathname: "/prog_acme_corp/workstreams",
      },
    },
  },
};

export const Tablet: Story = {
  args: {
    workstreams: allWorkstreams,
    programId: PROGRAM_ID,
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
    nextjs: {
      navigation: {
        pathname: "/prog_acme_corp/workstreams",
      },
    },
  },
};
