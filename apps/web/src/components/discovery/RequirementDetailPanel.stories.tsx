import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { RequirementDetailPanel } from "./RequirementDetailPanel";

// RequirementDetailPanel uses useQuery/useMutation from convex/react — mocked globally.
// It renders a fixed right-side panel (position: fixed), so we use fullscreen layout.

const meta: Meta<typeof RequirementDetailPanel> = {
  title: "Discovery/RequirementDetailPanel",
  component: RequirementDetailPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    requirementId: "req-1",
    programId: "prog-acme-corp",
    orgId: "org_acme",
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RequirementDetailPanel>;

export const Default: Story = {
  name: "Default (Loading State)",
  // The panel will show the loading state since Convex queries return undefined
  // in Storybook when not configured with real data.
};

export const WithDifferentRequirement: Story = {
  name: "Different Requirement ID",
  args: {
    requirementId: "req-42",
    programId: "prog-acme-corp",
    orgId: "org_acme",
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
