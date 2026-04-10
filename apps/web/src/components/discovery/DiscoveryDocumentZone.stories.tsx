import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { DiscoveryDocumentZone } from "./DiscoveryDocumentZone";

// DiscoveryDocumentZone uses useQuery, useMutation, and useAction from convex/react,
// plus the useUploadQueue hook — all mocked globally or via Storybook setup.
// The document list area will show "No documents uploaded yet." since useQuery
// returns undefined in Storybook (which resolves to an empty list in the component).

const meta: Meta<typeof DiscoveryDocumentZone> = {
  title: "Discovery/DiscoveryDocumentZone",
  component: DiscoveryDocumentZone,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog-acme-corp",
    orgId: "org_acme",
    targetPlatform: "salesforce_b2b",
    sortOrder: "newest",
    onSortOrderChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DiscoveryDocumentZone>;

export const Default: Story = {
  name: "Default (Salesforce B2B, Newest First)",
};

export const BigCommerceTarget: Story = {
  name: "BigCommerce B2B Target",
  args: {
    targetPlatform: "bigcommerce_b2b",
  },
};

export const SortedByName: Story = {
  name: "Sorted by Name",
  args: {
    sortOrder: "name",
  },
};

export const SortedOldestFirst: Story = {
  name: "Sorted Oldest First",
  args: {
    sortOrder: "oldest",
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
