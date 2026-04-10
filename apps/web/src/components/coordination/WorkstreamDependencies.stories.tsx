import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { WorkstreamDependencies } from "./WorkstreamDependencies";

// useQuery and useMutation from convex/react are globally mocked.
// Provide mock data via the convex parameter key.

const meta: Meta<typeof WorkstreamDependencies> = {
  title: "Coordination/WorkstreamDependencies",
  component: WorkstreamDependencies,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof WorkstreamDependencies>;

const baseProgramId = "prog_001" as any;
const baseOrgId = "org_acme_corp";

const mockDependencies = [
  {
    _id: "dep_001",
    sourceWorkstreamId: "ws_001",
    targetWorkstreamId: "ws_002",
    description: "CDI must complete customer schema mapping before CPM can migrate order history.",
    status: "active",
    sourceWorkstream: { _id: "ws_001", name: "Commerce Platform Migration", shortCode: "CPM" },
    targetWorkstream: { _id: "ws_002", name: "Customer Data Integration", shortCode: "CDI" },
  },
  {
    _id: "dep_002",
    sourceWorkstreamId: "ws_003",
    targetWorkstreamId: "ws_001",
    description: "Payment gateway credentials pending third-party approval.",
    status: "blocked",
    sourceWorkstream: { _id: "ws_003", name: "Payment Gateway Setup", shortCode: "PGS" },
    targetWorkstream: { _id: "ws_001", name: "Commerce Platform Migration", shortCode: "CPM" },
  },
  {
    _id: "dep_003",
    sourceWorkstreamId: "ws_004",
    targetWorkstreamId: "ws_005",
    description: "Search indexing must complete before analytics dashboards can be configured.",
    status: "resolved",
    sourceWorkstream: { _id: "ws_004", name: "Search & Catalog Rebuild", shortCode: "SCR" },
    targetWorkstream: { _id: "ws_005", name: "Reporting & Analytics", shortCode: "RAP" },
  },
];

const mockWorkstreams = [
  { _id: "ws_001", name: "Commerce Platform Migration", shortCode: "CPM" },
  { _id: "ws_002", name: "Customer Data Integration", shortCode: "CDI" },
  { _id: "ws_003", name: "Payment Gateway Setup", shortCode: "PGS" },
  { _id: "ws_004", name: "Search & Catalog Rebuild", shortCode: "SCR" },
  { _id: "ws_005", name: "Reporting & Analytics", shortCode: "RAP" },
];

export const Default: Story = {
  name: "With Dependencies",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": mockDependencies,
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const EmptyState: Story = {
  name: "Empty State",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": [],
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const SingleDependency: Story = {
  name: "Single Dependency",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": [mockDependencies[0]],
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const AllStatusVariants: Story = {
  name: "All Status Variants",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": mockDependencies,
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const OnlyBlockedDependencies: Story = {
  name: "Only Blocked Dependencies",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": [
        mockDependencies[1],
        {
          _id: "dep_004",
          sourceWorkstreamId: "ws_002",
          targetWorkstreamId: "ws_004",
          description: "Blocked waiting for data governance sign-off.",
          status: "blocked",
          sourceWorkstream: { _id: "ws_002", name: "Customer Data Integration", shortCode: "CDI" },
          targetWorkstream: { _id: "ws_004", name: "Search & Catalog Rebuild", shortCode: "SCR" },
        },
      ],
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const OnlyResolvedDependencies: Story = {
  name: "Only Resolved Dependencies",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": [mockDependencies[2]],
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const DependencyWithNoDescription: Story = {
  name: "Dependency With No Description",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": [
        {
          _id: "dep_005",
          sourceWorkstreamId: "ws_001",
          targetWorkstreamId: "ws_003",
          description: undefined,
          status: "active",
          sourceWorkstream: {
            _id: "ws_001",
            name: "Commerce Platform Migration",
            shortCode: "CPM",
          },
          targetWorkstream: { _id: "ws_003", name: "Payment Gateway Setup", shortCode: "PGS" },
        },
      ],
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const ManyDependencies: Story = {
  name: "Many Dependencies",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": [
        ...mockDependencies,
        {
          _id: "dep_006",
          sourceWorkstreamId: "ws_002",
          targetWorkstreamId: "ws_003",
          description: "Customer identity verification needed before payment setup.",
          status: "active",
          sourceWorkstream: { _id: "ws_002", name: "Customer Data Integration", shortCode: "CDI" },
          targetWorkstream: { _id: "ws_003", name: "Payment Gateway Setup", shortCode: "PGS" },
        },
        {
          _id: "dep_007",
          sourceWorkstreamId: "ws_005",
          targetWorkstreamId: "ws_002",
          description: "Analytics dashboards depend on finalized customer data model.",
          status: "blocked",
          sourceWorkstream: { _id: "ws_005", name: "Reporting & Analytics", shortCode: "RAP" },
          targetWorkstream: { _id: "ws_002", name: "Customer Data Integration", shortCode: "CDI" },
        },
      ],
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const ExpandDependencyInteraction: Story = {
  name: "Interaction: Expand Dependency Row",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": [mockDependencies[0]],
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The chevron expand button is the last button in the dependency row
    const expandButtons = canvas.getAllByRole("button");
    // Find the chevron/expand button (not status badge, not Add Dependency)
    const chevronButton = expandButtons.find(
      (btn) => !btn.textContent?.includes("Add") && !btn.textContent?.trim(),
    );

    if (chevronButton) {
      await userEvent.click(chevronButton);
      // After expanding, Source and Target labels should appear
      await expect(canvas.getByText("Source:")).toBeInTheDocument();
      await expect(canvas.getByText("Target:")).toBeInTheDocument();
    }
  },
};

export const OpenAddFormInteraction: Story = {
  name: "Interaction: Open Add Dependency Form",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    convex: {
      "workstreamDependencies.listByProgram": [],
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addButton = canvas.getByRole("button", { name: /add dependency/i });
    await userEvent.click(addButton);
    // The DependencyManager form should now appear
    await expect(canvas.getByText("New Dependency")).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "workstreamDependencies.listByProgram": mockDependencies,
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "workstreamDependencies.listByProgram": mockDependencies,
      "workstreams.listByProgram": mockWorkstreams,
    },
  },
};
