import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ActivityPage from "./page";

const meta = {
  title: "Pages/Activity/Main",
  component: ActivityPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ActivityPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    convexMockData: {
      "agentExecutions:listByProgram": [
        {
          _id: "exec-1" as any,
          _creationTime: Date.now() - 3600000,
          programId: "prog-acme-demo" as any,
          skillName: "Product Data Transform",
          taskType: "migration",
          status: "complete",
          reviewStatus: "accepted",
          userName: "Sarah Chen",
          outputSummary:
            "Successfully transformed 2,400 product records from Magento format to Salesforce B2B schema.",
          tokensUsed: 12500,
          durationMs: 45000,
        },
        {
          _id: "exec-2" as any,
          _creationTime: Date.now() - 7200000,
          programId: "prog-acme-demo" as any,
          skillName: "Order History ETL",
          taskType: "extraction",
          status: "complete",
          reviewStatus: "pending",
          userName: "Alex Kim",
          outputSummary: "Extracted 15,000 historical orders with line items and payment data.",
          tokensUsed: 8900,
          durationMs: 32000,
        },
        {
          _id: "exec-3" as any,
          _creationTime: Date.now() - 86400000,
          programId: "prog-acme-demo" as any,
          skillName: "Product Data Transform",
          taskType: "validation",
          status: "failed",
          reviewStatus: "rejected",
          userName: "Sarah Chen",
          outputSummary: "Validation failed: 12 SKUs missing category assignment.",
          tokensUsed: 3200,
          durationMs: 12000,
        },
      ],
    },
  },
};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "agentExecutions:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: "mobile" },
  },
};
