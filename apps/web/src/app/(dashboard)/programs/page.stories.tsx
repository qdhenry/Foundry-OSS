import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ProgramsPage from "./page";

const meta = {
  title: "Pages/Programs/List",
  component: ProgramsPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProgramsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    convexMockData: {
      "programs:list": [
        {
          _id: "prog-acme-demo" as any,
          _creationTime: Date.now() - 30 * 86400000,
          orgId: "org_foundry_demo",
          name: "AcmeCorp Migration",
          clientName: "AcmeCorp",
          sourcePlatform: "magento",
          targetPlatform: "salesforce_b2b",
          phase: "build",
          status: "active",
        },
        {
          _id: "prog-acme-demo" as any,
          _creationTime: Date.now() - 15 * 86400000,
          orgId: "org_foundry_demo",
          name: "Acme Industrial Replatform",
          clientName: "Acme Industrial",
          sourcePlatform: "magento",
          targetPlatform: "bigcommerce_b2b",
          phase: "discovery",
          status: "active",
        },
        {
          _id: "prog-legacy-demo" as any,
          _creationTime: Date.now() - 90 * 86400000,
          orgId: "org_foundry_demo",
          name: "Legacy Systems Upgrade",
          clientName: "TechCorp",
          sourcePlatform: "sitecore",
          targetPlatform: "salesforce_b2b",
          phase: "complete",
          status: "complete",
        },
      ],
    },
  },
};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "programs:list": [],
    },
  },
};

export const Mobile: Story = {
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: "mobile" },
  },
};
