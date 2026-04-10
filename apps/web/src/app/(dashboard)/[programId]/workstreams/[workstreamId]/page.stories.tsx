import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import WorkstreamDetailPage from "./page";

const meta = {
  title: "Pages/Workstreams/Detail",
  component: WorkstreamDetailPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/prog-acme-demo/workstreams/ws-1",
        segments: [
          ["programId", "prog-acme-demo"],
          ["workstreamId", "ws-1"],
        ],
      },
    },
  },
  args: {
    params: Promise.resolve({
      programId: "prog-acme-demo",
      workstreamId: "ws-1",
    }),
  },
} satisfies Meta<typeof WorkstreamDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    convexMockData: {
      "workstreams:get": {
        _id: "ws-1" as any,
        _creationTime: Date.now() - 14 * 86400000,
        orgId: "org_foundry_demo",
        programId: "prog-acme-demo" as any,
        name: "Product Data Migration",
        shortCode: "PDM",
        status: "on_track",
        description:
          "Migrate product catalog from Magento to Salesforce B2B Commerce. Includes SKU mapping, category hierarchies, pricing rules, and product attributes.",
        currentSprint: 2,
        sprintCadence: 2,
      },
      "requirements:listByProgram": [
        {
          _id: "req-1" as any,
          refId: "PDM-001",
          title: "Product SKU Mapping",
          priority: "must_have",
          status: "in_progress",
          fitGap: "custom_dev",
          workstreamId: "ws-1" as any,
        },
        {
          _id: "req-2" as any,
          refId: "PDM-002",
          title: "Category Hierarchy Rebuild",
          priority: "must_have",
          status: "complete",
          fitGap: "native",
          workstreamId: "ws-1" as any,
        },
        {
          _id: "req-3" as any,
          refId: "PDM-003",
          title: "Pricing Rules Migration",
          priority: "should_have",
          status: "draft",
          fitGap: "config",
          workstreamId: "ws-1" as any,
        },
      ],
      "tasks:listByProgram": [
        {
          _id: "task-1" as any,
          title: "Implement SKU transform",
          priority: "high",
          status: "in_progress",
          assigneeName: "Sarah Chen",
          workstreamId: "ws-1" as any,
        },
        {
          _id: "task-2" as any,
          title: "Category import script",
          priority: "high",
          status: "done",
          assigneeName: "Alex Kim",
          workstreamId: "ws-1" as any,
        },
      ],
      "sprintGates:listByWorkstream": [
        {
          _id: "gate-1" as any,
          name: "Sprint 1 Gate",
          gateType: "foundation",
          status: "passed",
          criteria: [
            { title: "Schema defined", passed: true },
            { title: "ETL pipeline tested", passed: true },
          ],
        },
        {
          _id: "gate-2" as any,
          name: "Sprint 2 Gate",
          gateType: "development",
          status: "pending",
          criteria: [
            { title: "SKU mapping complete", passed: false },
            { title: "Category import verified", passed: true },
          ],
        },
      ],
      "teamMembers:listByProgram": [
        {
          _id: "tm-1" as any,
          role: "architect",
          workstreamIds: ["ws-1" as any],
          user: { name: "Sarah Chen", email: "sarah@foundry.io" },
        },
        {
          _id: "tm-2" as any,
          role: "developer",
          workstreamIds: ["ws-1" as any],
          user: { name: "Alex Kim", email: "alex@foundry.io" },
        },
      ],
    },
  },
};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "workstreams:get": {
        _id: "ws-1" as any,
        _creationTime: Date.now(),
        orgId: "org_foundry_demo",
        programId: "prog-acme-demo" as any,
        name: "New Workstream",
        shortCode: "NEW",
        status: "on_track",
        currentSprint: 1,
      },
      "requirements:listByProgram": [],
      "tasks:listByProgram": [],
      "sprintGates:listByWorkstream": [],
      "teamMembers:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: "mobile" },
  },
};
