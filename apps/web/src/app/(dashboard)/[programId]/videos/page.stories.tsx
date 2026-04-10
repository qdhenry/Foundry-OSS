import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import VideosPage from "./page";

const meta = {
  title: "Pages/Videos/List",
  component: VideosPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof VideosPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    convexMockData: {
      "videoAnalysis:listByProgram": [
        {
          _id: "va-1" as any,
          _creationTime: Date.now() - 86400000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo" as any,
          fileName: "Discovery Call - AcmeCorp.mp4",
          status: "complete",
          durationMs: 3540000,
          videoDurationMs: 2700000,
          totalTokensUsed: 45200,
          findingsCount: 12,
        },
        {
          _id: "va-2" as any,
          _creationTime: Date.now() - 172800000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo" as any,
          fileName: "Sprint Review Week 3.mov",
          status: "analyzing",
          durationMs: null,
          videoDurationMs: 1800000,
          totalTokensUsed: 0,
          findingsCount: 0,
        },
        {
          _id: "va-3" as any,
          _creationTime: Date.now() - 259200000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo" as any,
          fileName: "Platform Walkthrough.webm",
          status: "failed",
          durationMs: null,
          videoDurationMs: null,
          totalTokensUsed: 0,
          findingsCount: 0,
          failedError: "Video codec not supported",
        },
      ],
    },
  },
};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "videoAnalysis:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: "mobile" },
  },
};
