import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuditEntry, type AuditEntryData } from "./AuditEntry";

const NOW = Date.now();
const minutesAgo = (m: number) => NOW - m * 60 * 1000;
const hoursAgo = (h: number) => NOW - h * 60 * 60 * 1000;
const daysAgo = (d: number) => NOW - d * 24 * 60 * 60 * 1000;

const baseEntry: AuditEntryData = {
  _id: "audit-001",
  action: "create",
  entityType: "requirement",
  entityId: "req-001",
  description: "Created requirement: Product SKU Mapping for Salesforce B2B Commerce",
  userName: "Sarah Chen",
  timestamp: minutesAgo(5),
};

const meta: Meta<typeof AuditEntry> = {
  title: "Audit/AuditEntry",
  component: AuditEntry,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    entry: {
      description: "The audit entry data object to display",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuditEntry>;

export const Default: Story = {
  args: {
    entry: baseEntry,
  },
};

export const CreateAction: Story = {
  name: "Action: Create",
  args: {
    entry: {
      _id: "audit-create-001",
      action: "create",
      entityType: "program",
      entityId: "prog-001",
      description: "Created program: AcmeCorp Magento to Salesforce Migration",
      userName: "Alex Kim",
      timestamp: minutesAgo(2),
    },
  },
};

export const UpdateAction: Story = {
  name: "Action: Update",
  args: {
    entry: {
      _id: "audit-update-001",
      action: "update",
      entityType: "requirement",
      entityId: "req-001",
      description: "Updated requirement priority from medium to must_have",
      userName: "Sarah Chen",
      timestamp: minutesAgo(15),
    },
  },
};

export const DeleteAction: Story = {
  name: "Action: Delete",
  args: {
    entry: {
      _id: "audit-delete-001",
      action: "delete",
      entityType: "risk",
      entityId: "risk-001",
      description: "Deleted risk: Legacy API compatibility concern",
      userName: "Jordan Park",
      timestamp: hoursAgo(1),
    },
  },
};

export const StatusChangeAction: Story = {
  name: "Action: Status Change",
  args: {
    entry: {
      _id: "audit-status-001",
      action: "status_change",
      entityType: "task",
      entityId: "task-001",
      description: "Status changed from in_progress to complete for Implement SKU mapping logic",
      userName: "Taylor Wong",
      timestamp: minutesAgo(30),
    },
  },
};

export const ProgramEntity: Story = {
  name: "Entity: Program",
  args: {
    entry: {
      _id: "audit-prog-001",
      action: "update",
      entityType: "program",
      entityId: "prog-001",
      description: "Updated program phase from discovery to build",
      userName: "Alex Kim",
      timestamp: hoursAgo(2),
    },
  },
};

export const RiskEntity: Story = {
  name: "Entity: Risk",
  args: {
    entry: {
      _id: "audit-risk-001",
      action: "create",
      entityType: "risk",
      entityId: "risk-002",
      description: "Created risk: Data loss during product migration window",
      userName: "Sarah Chen",
      timestamp: daysAgo(1),
    },
  },
};

export const SkillEntity: Story = {
  name: "Entity: Skill",
  args: {
    entry: {
      _id: "audit-skill-001",
      action: "update",
      entityType: "skill",
      entityId: "skill-001",
      description: "Updated skill: Product Data Transform — added new transformation rules",
      userName: "Jordan Park",
      timestamp: daysAgo(2),
    },
  },
};

export const GateEntity: Story = {
  name: "Entity: Gate",
  args: {
    entry: {
      _id: "audit-gate-001",
      action: "status_change",
      entityType: "gate",
      entityId: "gate-001",
      description: "Sprint 2 gate status changed from pending to passed",
      userName: "Taylor Wong",
      timestamp: hoursAgo(4),
    },
  },
};

export const IntegrationEntity: Story = {
  name: "Entity: Integration",
  args: {
    entry: {
      _id: "audit-intg-001",
      action: "create",
      entityType: "integration",
      entityId: "intg-001",
      description: "Connected Jira workspace: Acme JIRA",
      userName: "Alex Kim",
      timestamp: daysAgo(3),
    },
  },
};

export const DocumentEntity: Story = {
  name: "Entity: Document",
  args: {
    entry: {
      _id: "audit-doc-001",
      action: "create",
      entityType: "document",
      entityId: "doc-001",
      description: "Uploaded document: AcmeCorp Requirements v3.pdf",
      userName: "Sarah Chen",
      timestamp: daysAgo(5),
    },
  },
};

export const UnknownEntity: Story = {
  name: "Entity: Unknown (fallback badge)",
  args: {
    entry: {
      _id: "audit-unk-001",
      action: "update",
      entityType: "webhook",
      entityId: "wh-001",
      description: "Updated webhook endpoint configuration for GitHub integration",
      userName: "Jordan Park",
      timestamp: minutesAgo(45),
    },
  },
};

export const LongDescription: Story = {
  name: "Long Description (truncated)",
  args: {
    entry: {
      _id: "audit-long-001",
      action: "update",
      entityType: "requirement",
      entityId: "req-long-001",
      description:
        "Updated requirement: Product SKU Mapping — revised acceptance criteria to include batch validation logic, updated complexity from low to high, reassigned from Sarah Chen to Alex Kim, and linked to workstream Product Data Migration with detailed notes about Magento custom attribute handling",
      userName: "Sarah Chen",
      timestamp: minutesAgo(8),
    },
  },
};

export const JustNow: Story = {
  name: "Timestamp: Just Now",
  args: {
    entry: {
      ...baseEntry,
      _id: "audit-now-001",
      timestamp: NOW - 10 * 1000,
    },
  },
};

export const OldEntry: Story = {
  name: "Timestamp: Old Entry",
  args: {
    entry: {
      ...baseEntry,
      _id: "audit-old-001",
      timestamp: daysAgo(30),
    },
  },
};

export const WithMetadata: Story = {
  name: "With Metadata",
  args: {
    entry: {
      _id: "audit-meta-001",
      action: "status_change",
      entityType: "requirement",
      entityId: "req-001",
      description: "Status changed from open to in_progress",
      userName: "Sarah Chen",
      timestamp: minutesAgo(10),
      metadata: {
        previousStatus: "open",
        newStatus: "in_progress",
        triggeredBy: "sprint_planning",
      },
    },
  },
};

export const Mobile: Story = {
  args: {
    entry: baseEntry,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const Tablet: Story = {
  args: {
    entry: {
      _id: "audit-tablet-001",
      action: "update",
      entityType: "skill",
      entityId: "skill-001",
      description: "Updated skill: Order History ETL — added incremental sync support",
      userName: "Taylor Wong",
      timestamp: minutesAgo(20),
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
