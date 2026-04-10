import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AuditPage from "./page";

const meta = {
  title: "Pages/Audit/Main",
  component: AuditPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuditPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    convexMockData: {
      "auditLog:listByProgram": [
        {
          _id: "audit-1" as any,
          _creationTime: Date.now() - 3600000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo" as any,
          entityType: "requirement",
          entityId: "req-1" as any,
          action: "created",
          actorName: "Sarah Chen",
          actorId: "user-1" as any,
          details: "Created requirement: Product SKU Mapping",
          timestamp: Date.now() - 3600000,
        },
        {
          _id: "audit-2" as any,
          _creationTime: Date.now() - 7200000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo" as any,
          entityType: "skill",
          entityId: "skill-1" as any,
          action: "updated",
          actorName: "Alex Kim",
          actorId: "user-2" as any,
          details: "Updated skill: Product Data Transform v2",
          timestamp: Date.now() - 7200000,
        },
        {
          _id: "audit-3" as any,
          _creationTime: Date.now() - 86400000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo" as any,
          entityType: "workstream",
          entityId: "ws-1" as any,
          action: "status_changed",
          actorName: "Demo User",
          actorId: "user-1" as any,
          details: "Changed status of Product Data Migration to on_track",
          timestamp: Date.now() - 86400000,
        },
        {
          _id: "audit-4" as any,
          _creationTime: Date.now() - 172800000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo" as any,
          entityType: "risk",
          entityId: "risk-1" as any,
          action: "created",
          actorName: "Sarah Chen",
          actorId: "user-1" as any,
          details: "Created risk: Data Loss During Migration",
          timestamp: Date.now() - 172800000,
        },
      ],
    },
  },
};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "auditLog:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: "mobile" },
  },
};
