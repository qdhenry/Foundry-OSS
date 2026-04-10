import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AnalysisProgress } from "./AnalysisProgress";

// AnalysisProgress uses useQuery from convex/react — mocked globally.
// The component renders a loading skeleton when progress === undefined,
// and an empty state when progress.length === 0.

const meta: Meta<typeof AnalysisProgress> = {
  title: "Discovery/AnalysisProgress",
  component: AnalysisProgress,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog-acme-corp",
  },
};

export default meta;
type Story = StoryObj<typeof AnalysisProgress>;

export const Default: Story = {
  name: "Default (Loading Skeleton)",
  // Convex useQuery returns undefined in Storybook → renders loading skeleton
};

export const DifferentProgram: Story = {
  name: "Different Program ID",
  args: {
    programId: "prog-acme-migration",
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
