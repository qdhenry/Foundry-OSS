import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SpeakerMappingPanel } from "./SpeakerMappingPanel";

const meta: Meta<typeof SpeakerMappingPanel> = {
  title: "Videos/SpeakerMappingPanel",
  component: SpeakerMappingPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    programId: { control: "text" },
    analysisId: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof SpeakerMappingPanel>;

export const Default: Story = {
  args: {
    programId: "program-123",
    analysisId: "analysis-abc",
  },
};

export const AlternateAnalysis: Story = {
  args: {
    programId: "program-456",
    analysisId: "analysis-xyz",
  },
};

export const Mobile: Story = {
  args: {
    programId: "program-123",
    analysisId: "analysis-abc",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    programId: "program-123",
    analysisId: "analysis-abc",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
