import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { DiscoveryTabBar } from "./DiscoveryTabBar";

const meta: Meta<typeof DiscoveryTabBar> = {
  title: "Discovery/DiscoveryTabBar",
  component: DiscoveryTabBar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onTabChange: fn(),
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 0,
    importedCount: 0,
  },
};

export default meta;
type Story = StoryObj<typeof DiscoveryTabBar>;

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    activeTab: "documents",
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 34,
    importedCount: 84,
  },
};

export const DocumentsActive: Story = {
  name: "Active — Documents Tab",
  args: {
    activeTab: "documents",
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 34,
    importedCount: 84,
  },
};

export const FindingsActive: Story = {
  name: "Active — Findings Tab",
  args: {
    activeTab: "findings",
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 34,
    importedCount: 84,
  },
};

export const ImportedActive: Story = {
  name: "Active — Imported Tab",
  args: {
    activeTab: "imported",
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 34,
    importedCount: 84,
  },
};

export const WithAnalyzing: Story = {
  name: "Documents Tab — Analyzing Dot Indicator",
  args: {
    activeTab: "documents",
    documentCount: 12,
    analyzingCount: 3,
    pendingFindingsCount: 0,
    importedCount: 72,
  },
};

export const PendingFindingsAttention: Story = {
  name: "Findings Tab — Pending Badge (attention)",
  args: {
    activeTab: "documents",
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 47,
    importedCount: 62,
  },
};

export const AllZeroBadges: Story = {
  name: "All Zero Counts (no badges)",
  args: {
    activeTab: "documents",
    documentCount: 0,
    analyzingCount: 0,
    pendingFindingsCount: 0,
    importedCount: 0,
  },
};

export const AcmeCorpFull: Story = {
  name: "AcmeCorp — Full State",
  args: {
    activeTab: "findings",
    documentCount: 23,
    analyzingCount: 1,
    pendingFindingsCount: 18,
    importedCount: 118,
  },
};

export const SwitchToFindings: Story = {
  name: "Interaction — Switch to Findings Tab",
  args: {
    activeTab: "documents",
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 18,
    importedCount: 84,
    onTabChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const findingsTab = canvas.getByRole("button", { name: /findings/i });
    await expect(findingsTab).toBeInTheDocument();
    await userEvent.click(findingsTab);
    await expect(args.onTabChange).toHaveBeenCalledWith("findings");
  },
};

export const SwitchToImported: Story = {
  name: "Interaction — Switch to Imported Tab",
  args: {
    activeTab: "documents",
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 0,
    importedCount: 118,
    onTabChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const importedTab = canvas.getByRole("button", { name: /imported/i });
    await userEvent.click(importedTab);
    await expect(args.onTabChange).toHaveBeenCalledWith("imported");
  },
};

export const Mobile: Story = {
  args: {
    activeTab: "findings",
    documentCount: 12,
    analyzingCount: 0,
    pendingFindingsCount: 34,
    importedCount: 84,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    activeTab: "documents",
    documentCount: 23,
    analyzingCount: 1,
    pendingFindingsCount: 18,
    importedCount: 118,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
