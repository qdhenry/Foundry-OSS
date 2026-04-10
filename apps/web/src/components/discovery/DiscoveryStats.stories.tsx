import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { DiscoveryStats } from "./DiscoveryStats";

const meta: Meta<typeof DiscoveryStats> = {
  title: "Discovery/DiscoveryStats",
  component: DiscoveryStats,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onStatClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DiscoveryStats>;

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    documentCount: 12,
    pendingFindingsCount: 34,
    requirementsCount: 84,
    analyzingCount: 2,
  },
};

export const AllZeros: Story = {
  name: "Empty — All Zeros",
  args: {
    documentCount: 0,
    pendingFindingsCount: 0,
    requirementsCount: 0,
    analyzingCount: 0,
  },
};

export const NoPendingFindings: Story = {
  name: "No Pending Findings (neutral tone)",
  args: {
    documentCount: 12,
    pendingFindingsCount: 0,
    requirementsCount: 118,
    analyzingCount: 0,
  },
};

export const ActiveAnalysis: Story = {
  name: "Active Analysis (info tone on Analyzing card)",
  args: {
    documentCount: 8,
    pendingFindingsCount: 0,
    requirementsCount: 72,
    analyzingCount: 3,
  },
};

export const PendingFindingsAttention: Story = {
  name: "Pending Findings Attention (warning tone)",
  args: {
    documentCount: 15,
    pendingFindingsCount: 47,
    requirementsCount: 62,
    analyzingCount: 0,
  },
};

export const FullAcmeCorp: Story = {
  name: "AcmeCorp — Full State",
  args: {
    documentCount: 23,
    pendingFindingsCount: 18,
    requirementsCount: 118,
    analyzingCount: 1,
  },
};

export const ClickDocuments: Story = {
  name: "Interaction — Click Documents Card",
  args: {
    documentCount: 12,
    pendingFindingsCount: 5,
    requirementsCount: 84,
    analyzingCount: 0,
    onStatClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const documentsCard = canvas.getByRole("button", { name: /documents/i });
    await userEvent.click(documentsCard);
    await expect(args.onStatClick).toHaveBeenCalledWith("documents");
  },
};

export const ClickPendingFindings: Story = {
  name: "Interaction — Click Pending Findings Card",
  args: {
    documentCount: 12,
    pendingFindingsCount: 34,
    requirementsCount: 84,
    analyzingCount: 0,
    onStatClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const findingsCard = canvas.getByRole("button", { name: /pending findings/i });
    await userEvent.click(findingsCard);
    await expect(args.onStatClick).toHaveBeenCalledWith("findings");
  },
};

export const ClickRequirements: Story = {
  name: "Interaction — Click Requirements Card",
  args: {
    documentCount: 12,
    pendingFindingsCount: 0,
    requirementsCount: 118,
    analyzingCount: 0,
    onStatClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const reqCard = canvas.getByRole("button", { name: /requirements/i });
    await userEvent.click(reqCard);
    await expect(args.onStatClick).toHaveBeenCalledWith("imported");
  },
};

export const NoClickHandler: Story = {
  name: "No Click Handler (read-only display)",
  args: {
    documentCount: 12,
    pendingFindingsCount: 5,
    requirementsCount: 84,
    analyzingCount: 2,
    onStatClick: undefined,
  },
};

export const Mobile: Story = {
  args: {
    documentCount: 12,
    pendingFindingsCount: 34,
    requirementsCount: 84,
    analyzingCount: 2,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    documentCount: 12,
    pendingFindingsCount: 34,
    requirementsCount: 84,
    analyzingCount: 2,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
