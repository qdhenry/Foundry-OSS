import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VideoActivityFeed } from "./VideoActivityFeed";

const NOW = Date.now();

const mockLogs = [
  {
    _id: "log-1",
    _creationTime: NOW - 120000,
    step: "upload",
    message: "Video file received and queued for processing.",
    level: "info" as const,
  },
  {
    _id: "log-2",
    _creationTime: NOW - 110000,
    step: "upload",
    message: "File uploaded to storage successfully.",
    level: "success" as const,
  },
  {
    _id: "log-3",
    _creationTime: NOW - 100000,
    step: "indexing",
    message: "Indexing video with Twelve Labs...",
    level: "info" as const,
  },
  {
    _id: "log-4",
    _creationTime: NOW - 80000,
    step: "indexing",
    message: "Frame extraction complete. 42 keyframes captured.",
    level: "success" as const,
  },
  {
    _id: "log-5",
    _creationTime: NOW - 60000,
    step: "transcription",
    message: "Transcription complete. 3 speakers detected.",
    level: "success" as const,
    detail: "Speaker A, Speaker B, Speaker C",
  },
  {
    _id: "log-6",
    _creationTime: NOW - 40000,
    step: "analysis",
    message: "Running Claude analysis on video segments...",
    level: "info" as const,
  },
  {
    _id: "log-7",
    _creationTime: NOW - 10000,
    step: "analysis",
    message: "Analysis complete. 12 findings extracted.",
    level: "success" as const,
  },
];

const mockLogsWithError = [
  {
    _id: "log-1",
    _creationTime: NOW - 90000,
    step: "upload",
    message: "Video file received.",
    level: "info" as const,
  },
  {
    _id: "log-2",
    _creationTime: NOW - 80000,
    step: "indexing",
    message: "Starting Twelve Labs indexing job.",
    level: "info" as const,
  },
  {
    _id: "log-3",
    _creationTime: NOW - 30000,
    step: "indexing",
    message: "Indexing failed: upstream timeout after 60s.",
    level: "error" as const,
  },
];

const meta: Meta<typeof VideoActivityFeed> = {
  title: "Videos/VideoActivityFeed",
  component: VideoActivityFeed,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof VideoActivityFeed>;

export const Default: Story = {
  args: {
    logs: mockLogs,
  },
};

export const Loading: Story = {
  args: {
    logs: undefined,
  },
};

export const Empty: Story = {
  args: {
    logs: [],
  },
};

export const WithError: Story = {
  args: {
    logs: mockLogsWithError,
  },
};

export const SingleEntry: Story = {
  args: {
    logs: [mockLogs[0]],
  },
};

export const Mobile: Story = {
  args: {
    logs: mockLogs,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    logs: mockLogs,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
