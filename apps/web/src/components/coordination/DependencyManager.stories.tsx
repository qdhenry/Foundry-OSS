import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { DependencyManager } from "./DependencyManager";

// useQuery and useMutation from convex/react are globally mocked.
// We provide mock return values via the convex mock globals where needed.

const meta: Meta<typeof DependencyManager> = {
  title: "Coordination/DependencyManager",
  component: DependencyManager,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    convex: {
      // Mock workstreams.listByProgram query response
      "workstreams.listByProgram": [
        {
          _id: "ws_001",
          name: "Commerce Platform Migration",
          shortCode: "CPM",
        },
        {
          _id: "ws_002",
          name: "Customer Data Integration",
          shortCode: "CDI",
        },
        {
          _id: "ws_003",
          name: "Payment Gateway Setup",
          shortCode: "PGS",
        },
        {
          _id: "ws_004",
          name: "Search & Catalog Rebuild",
          shortCode: "SCR",
        },
        {
          _id: "ws_005",
          name: "Reporting & Analytics",
          shortCode: "RAP",
        },
      ],
    },
  },
  argTypes: {
    onClose: { action: "closed" },
  },
};

export default meta;
type Story = StoryObj<typeof DependencyManager>;

const baseProgramId = "prog_001" as any;
const baseOrgId = "org_acme_corp";

export const Default: Story = {
  name: "Create New Dependency",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: undefined,
    onClose: fn(),
  },
};

export const EditExistingDependency: Story = {
  name: "Edit Existing Dependency",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: {
      _id: "dep_001" as any,
      sourceWorkstreamId: "ws_001" as any,
      targetWorkstreamId: "ws_002" as any,
      description:
        "CDI must complete customer schema mapping before CPM can migrate order history.",
      status: "active",
    },
    onClose: fn(),
  },
};

export const EditBlockedDependency: Story = {
  name: "Edit: Blocked Status",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: {
      _id: "dep_002" as any,
      sourceWorkstreamId: "ws_003" as any,
      targetWorkstreamId: "ws_001" as any,
      description: "Payment gateway credentials pending third-party approval.",
      status: "blocked",
    },
    onClose: fn(),
  },
};

export const EditResolvedDependency: Story = {
  name: "Edit: Resolved Status",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: {
      _id: "dep_003" as any,
      sourceWorkstreamId: "ws_004" as any,
      targetWorkstreamId: "ws_005" as any,
      description: "Search indexing must complete before analytics dashboards can be built.",
      status: "resolved",
    },
    onClose: fn(),
  },
};

export const EditNoDescription: Story = {
  name: "Edit: No Description",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: {
      _id: "dep_004" as any,
      sourceWorkstreamId: "ws_002" as any,
      targetWorkstreamId: "ws_005" as any,
      description: undefined,
      status: "active",
    },
    onClose: fn(),
  },
};

export const FillAndSubmitNew: Story = {
  name: "Interaction: Fill and Submit New",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: undefined,
    onClose: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Select source workstream
    const selects = canvas.getAllByRole("combobox");
    const sourceSelect = selects[0];
    const targetSelect = selects[1];

    await userEvent.selectOptions(sourceSelect, "ws_001");
    await userEvent.selectOptions(targetSelect, "ws_002");

    // Fill description
    const textarea = canvas.getByPlaceholderText("Describe the dependency relationship...");
    await userEvent.type(textarea, "CDI must complete schema mapping before CPM migration.");

    // Set status to blocked
    const statusSelect = selects[2];
    await userEvent.selectOptions(statusSelect, "blocked");
  },
};

export const CancelInteraction: Story = {
  name: "Interaction: Cancel Button",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: undefined,
    onClose: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const cancelButton = canvas.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const ValidationError: Story = {
  name: "Interaction: Validation Error (Empty Submit)",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: undefined,
    onClose: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByRole("button", { name: /create/i });
    await userEvent.click(submitButton);
    // Error message should appear
    await expect(
      canvas.getByText("Please select both source and target workstreams."),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: undefined,
    onClose: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  args: {
    programId: baseProgramId,
    orgId: baseOrgId,
    dependency: {
      _id: "dep_001" as any,
      sourceWorkstreamId: "ws_001" as any,
      targetWorkstreamId: "ws_003" as any,
      description: "Payment setup depends on commerce platform decisions.",
      status: "active",
    },
    onClose: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
