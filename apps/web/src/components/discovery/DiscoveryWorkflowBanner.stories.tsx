import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { DiscoveryWorkflowBanner } from "./DiscoveryWorkflowBanner";

const meta: Meta<typeof DiscoveryWorkflowBanner> = {
  title: "Discovery/DiscoveryWorkflowBanner",
  component: DiscoveryWorkflowBanner,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onSwitchTab: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DiscoveryWorkflowBanner>;

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    activeTab: "documents",
    documentCount: 0,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 0,
  },
};

export const NoDocuments: Story = {
  name: "State — No Documents (info, shows Go to Documents)",
  args: {
    activeTab: "findings",
    documentCount: 0,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 0,
  },
};

export const NoDocumentsOnDocumentsTab: Story = {
  name: "State — No Documents, Already on Documents Tab (no action button)",
  args: {
    activeTab: "documents",
    documentCount: 0,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 0,
  },
};

export const PendingFindings: Story = {
  name: "State — Pending Findings (warning, shows Review Findings)",
  args: {
    activeTab: "documents",
    documentCount: 12,
    pendingFindingsCount: 34,
    approvedCount: 0,
    importedCount: 0,
  },
};

export const PendingFindingsSingular: Story = {
  name: "State — 1 Pending Finding (singular grammar)",
  args: {
    activeTab: "documents",
    documentCount: 5,
    pendingFindingsCount: 1,
    approvedCount: 0,
    importedCount: 0,
  },
};

export const PendingFindingsOnFindingsTab: Story = {
  name: "State — Pending Findings, Already on Findings Tab (no action button)",
  args: {
    activeTab: "findings",
    documentCount: 12,
    pendingFindingsCount: 34,
    approvedCount: 0,
    importedCount: 0,
  },
};

export const ApprovedReadyToImport: Story = {
  name: "State — Approved Findings Ready to Import (success)",
  args: {
    activeTab: "documents",
    documentCount: 12,
    pendingFindingsCount: 0,
    approvedCount: 18,
    importedCount: 0,
  },
};

export const ApprovedReadyToImportSingular: Story = {
  name: "State — 1 Approved Finding (singular grammar)",
  args: {
    activeTab: "documents",
    documentCount: 5,
    pendingFindingsCount: 0,
    approvedCount: 1,
    importedCount: 0,
  },
};

export const AllProcessed: Story = {
  name: "State — All Findings Processed (success, view imported)",
  args: {
    activeTab: "documents",
    documentCount: 23,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 118,
  },
};

export const AllProcessedOnImportedTab: Story = {
  name: "State — All Processed, Already on Imported Tab (no action button)",
  args: {
    activeTab: "imported",
    documentCount: 23,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 118,
  },
};

export const HiddenWhenNoActionableState: Story = {
  name: "Hidden — No Actionable State (returns null)",
  args: {
    activeTab: "documents",
    documentCount: 12,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 0,
  },
};

export const ReviewFindingsAction: Story = {
  name: "Interaction — Click Review Findings",
  args: {
    activeTab: "documents",
    documentCount: 12,
    pendingFindingsCount: 18,
    approvedCount: 0,
    importedCount: 0,
    onSwitchTab: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole("button", { name: /review findings/i });
    await expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    await expect(args.onSwitchTab).toHaveBeenCalledWith("findings");
  },
};

export const GoToDocumentsAction: Story = {
  name: "Interaction — Click Go to Documents",
  args: {
    activeTab: "findings",
    documentCount: 0,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 0,
    onSwitchTab: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole("button", { name: /go to documents/i });
    await expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    await expect(args.onSwitchTab).toHaveBeenCalledWith("documents");
  },
};

export const ImportFindingsAction: Story = {
  name: "Interaction — Click Import Findings",
  args: {
    activeTab: "documents",
    documentCount: 12,
    pendingFindingsCount: 0,
    approvedCount: 8,
    importedCount: 0,
    onSwitchTab: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole("button", { name: /import findings/i });
    await expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    await expect(args.onSwitchTab).toHaveBeenCalledWith("findings");
  },
};

export const Mobile: Story = {
  args: {
    activeTab: "documents",
    documentCount: 12,
    pendingFindingsCount: 34,
    approvedCount: 0,
    importedCount: 0,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    activeTab: "documents",
    documentCount: 12,
    pendingFindingsCount: 18,
    approvedCount: 0,
    importedCount: 84,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
