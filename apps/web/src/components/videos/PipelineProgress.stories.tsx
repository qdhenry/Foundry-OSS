import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineProgress } from "./PipelineProgress";

const NOW = Date.now();

const meta: Meta<typeof PipelineProgress> = {
  title: "Videos/PipelineProgress",
  component: PipelineProgress,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    status: {
      control: "select",
      options: [
        "uploading",
        "indexing",
        "analyzing",
        "complete",
        "failed",
        "extracting",
        "transcribing",
        "classifying_frames",
        "awaiting_speakers",
        "synthesizing",
      ],
    },
    failedStage: { control: "text" },
    failedError: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof PipelineProgress>;

export const Uploading: Story = {
  args: {
    status: "uploading",
    stageTimestamps: {},
  },
};

export const Indexing: Story = {
  args: {
    status: "indexing",
    stageTimestamps: {
      uploadingAt: NOW - 60000,
    },
  },
};

export const Analyzing: Story = {
  args: {
    status: "analyzing",
    stageTimestamps: {
      uploadingAt: NOW - 120000,
      indexingAt: NOW - 60000,
    },
  },
};

export const Complete: Story = {
  args: {
    status: "complete",
    stageTimestamps: {
      uploadingAt: NOW - 300000,
      indexingAt: NOW - 240000,
      analyzingAt: NOW - 120000,
      completedAt: NOW - 30000,
    },
  },
};

export const Failed: Story = {
  args: {
    status: "failed",
    stageTimestamps: {
      uploadingAt: NOW - 180000,
      indexingAt: NOW - 120000,
    },
    failedStage: "analyzing",
    failedError:
      "Claude analysis timed out after 120s. The video may be too long or have insufficient audio content.",
  },
};

export const FailedAtIndexing: Story = {
  args: {
    status: "failed",
    stageTimestamps: {
      uploadingAt: NOW - 120000,
    },
    failedStage: "indexing",
    failedError: "Twelve Labs indexing job failed: unsupported video codec.",
  },
};

export const LegacyStatusTranscribing: Story = {
  name: "Legacy: Transcribing",
  args: {
    status: "transcribing",
    stageTimestamps: {
      uploadingAt: NOW - 90000,
      indexingAt: NOW - 60000,
    },
  },
};

export const LegacyStatusSynthesizing: Story = {
  name: "Legacy: Synthesizing",
  args: {
    status: "synthesizing",
    stageTimestamps: {
      uploadingAt: NOW - 180000,
      indexingAt: NOW - 120000,
      analyzingAt: NOW - 60000,
    },
  },
};

export const Mobile: Story = {
  args: {
    status: "analyzing",
    stageTimestamps: {
      uploadingAt: NOW - 120000,
      indexingAt: NOW - 60000,
    },
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    status: "complete",
    stageTimestamps: {
      uploadingAt: NOW - 300000,
      indexingAt: NOW - 240000,
      analyzingAt: NOW - 120000,
      completedAt: NOW - 30000,
    },
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
