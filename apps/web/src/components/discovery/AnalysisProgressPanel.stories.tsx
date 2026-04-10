import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { AnalysisProgressPanel } from "./AnalysisProgressPanel";

// AnalysisProgressPanel uses useQuery and useAction from convex/react — mocked globally.
// When trackedRows.length === 0 (no documents with analysis status), the component
// returns null and renders nothing.

const meta: Meta<typeof AnalysisProgressPanel> = {
  title: "Discovery/AnalysisProgressPanel",
  component: AnalysisProgressPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog-acme-corp",
    orgId: "org_acme",
    targetPlatform: "salesforce_b2b",
    onComplete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AnalysisProgressPanel>;

export const Default: Story = {
  name: "Default (Salesforce B2B Target)",
  // useQuery returns undefined in Storybook — component renders nothing (returns null)
  // since trackedRows.length === 0 when documents is undefined
};

export const BigCommerceTarget: Story = {
  name: "BigCommerce B2B Target",
  args: {
    targetPlatform: "bigcommerce_b2b",
  },
};

export const WithoutCompletionCallback: Story = {
  name: "Without onComplete Callback",
  args: {
    onComplete: undefined,
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
