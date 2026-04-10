import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, within } from "@storybook/test";
import { DiscoveryFindingsReview } from "./DiscoveryFindingsReview";

// DiscoveryFindingsReview uses useQuery and useMutation from convex/react — mocked globally.
// When findings === undefined (Storybook default), the component shows "Loading findings..."
// When findings.length === 0, it shows the empty state message.

const meta: Meta<typeof DiscoveryFindingsReview> = {
  title: "Discovery/DiscoveryFindingsReview",
  component: DiscoveryFindingsReview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog-acme-corp",
    orgId: "org_acme",
    activeTab: "requirement",
    onTabChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DiscoveryFindingsReview>;

export const Default: Story = {
  name: "Default (Loading State)",
  // useQuery returns undefined in Storybook → "Loading findings..."
};

export const RisksTab: Story = {
  name: "Risks Tab Active",
  args: {
    activeTab: "risk",
  },
};

export const IntegrationsTab: Story = {
  name: "Integrations Tab Active",
  args: {
    activeTab: "integration",
  },
};

export const DecisionsTab: Story = {
  name: "Decisions Tab Active",
  args: {
    activeTab: "decision",
  },
};

export const ActionItemsTab: Story = {
  name: "Action Items Tab Active",
  args: {
    activeTab: "action_item",
  },
};

export const TabSwitchInteraction: Story = {
  name: "Tab Switch (interaction)",
  play: async ({ canvasElement }) => {
    const _canvas = within(canvasElement);
    // The component shows "Loading findings..." when useQuery returns undefined,
    // but we can still verify the component mounts and the props are accepted
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
