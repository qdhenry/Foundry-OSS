import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { AuditEntryData } from "./AuditEntry";
import { AuditTimeline } from "./AuditTimeline";

const NOW = Date.now();
const minutesAgo = (m: number) => NOW - m * 60 * 1000;
const hoursAgo = (h: number) => NOW - h * 60 * 60 * 1000;
const daysAgo = (d: number) => NOW - d * 24 * 60 * 60 * 1000;

const todayEntries: AuditEntryData[] = [
  {
    _id: "audit-t-001",
    action: "create",
    entityType: "requirement",
    entityId: "req-001",
    description: "Created requirement: Product SKU Mapping for Salesforce B2B",
    userName: "Sarah Chen",
    timestamp: minutesAgo(5),
  },
  {
    _id: "audit-t-002",
    action: "update",
    entityType: "task",
    entityId: "task-001",
    description: "Updated task priority from medium to high",
    userName: "Alex Kim",
    timestamp: minutesAgo(22),
  },
  {
    _id: "audit-t-003",
    action: "status_change",
    entityType: "requirement",
    entityId: "req-002",
    description: "Status changed from open to in_progress: Category Hierarchy",
    userName: "Jordan Park",
    timestamp: minutesAgo(45),
  },
  {
    _id: "audit-t-004",
    action: "create",
    entityType: "risk",
    entityId: "risk-001",
    description: "Created risk: Data loss during migration window — severity critical",
    userName: "Taylor Wong",
    timestamp: hoursAgo(2),
  },
  {
    _id: "audit-t-005",
    action: "delete",
    entityType: "task",
    entityId: "task-old-001",
    description: "Deleted duplicate task: Legacy API stub validation",
    userName: "Sarah Chen",
    timestamp: hoursAgo(5),
  },
];

const yesterdayEntries: AuditEntryData[] = [
  {
    _id: "audit-y-001",
    action: "update",
    entityType: "skill",
    entityId: "skill-001",
    description: "Updated skill: Product Data Transform — added incremental sync logic",
    userName: "Alex Kim",
    timestamp: daysAgo(1) + hoursAgo(3),
  },
  {
    _id: "audit-y-002",
    action: "create",
    entityType: "program",
    entityId: "prog-001",
    description: "Created program: AcmeCorp Migration — Phase 1",
    userName: "Jordan Park",
    timestamp: daysAgo(1) + hoursAgo(6),
  },
];

const olderEntries: AuditEntryData[] = [
  {
    _id: "audit-o-001",
    action: "status_change",
    entityType: "gate",
    entityId: "gate-001",
    description: "Sprint 1 gate status changed from pending to passed",
    userName: "Taylor Wong",
    timestamp: daysAgo(3),
  },
  {
    _id: "audit-o-002",
    action: "create",
    entityType: "integration",
    entityId: "intg-001",
    description: "Connected Jira workspace: Acme JIRA",
    userName: "Sarah Chen",
    timestamp: daysAgo(5),
  },
];

const allEntries: AuditEntryData[] = [...todayEntries, ...yesterdayEntries, ...olderEntries];

const meta: Meta<typeof AuditTimeline> = {
  title: "Audit/AuditTimeline",
  component: AuditTimeline,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    entries: {
      description:
        "Sorted (newest-first) list of audit entry records to group and display in the timeline",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuditTimeline>;

export const Default: Story = {
  args: {
    entries: allEntries,
  },
};

export const Empty: Story = {
  args: {
    entries: [],
  },
};

export const TodayOnly: Story = {
  name: "Today's Entries Only",
  args: {
    entries: todayEntries,
  },
};

export const YesterdayOnly: Story = {
  name: "Yesterday's Entries Only",
  args: {
    entries: yesterdayEntries,
  },
};

export const MultiDayGroups: Story = {
  name: "Multi-Day Groups",
  args: {
    entries: allEntries,
  },
};

export const AllCreateActions: Story = {
  name: "All Create Actions",
  args: {
    entries: [
      {
        _id: "audit-c-001",
        action: "create",
        entityType: "program",
        entityId: "prog-001",
        description: "Created program: AcmeCorp Migration",
        userName: "Alex Kim",
        timestamp: minutesAgo(5),
      },
      {
        _id: "audit-c-002",
        action: "create",
        entityType: "workstream",
        entityId: "ws-001",
        description: "Created workstream: Product Data Migration",
        userName: "Sarah Chen",
        timestamp: minutesAgo(15),
      },
      {
        _id: "audit-c-003",
        action: "create",
        entityType: "requirement",
        entityId: "req-001",
        description: "Created requirement: Product SKU Mapping",
        userName: "Jordan Park",
        timestamp: minutesAgo(30),
      },
      {
        _id: "audit-c-004",
        action: "create",
        entityType: "skill",
        entityId: "skill-001",
        description: "Created skill: Product Data Transform",
        userName: "Taylor Wong",
        timestamp: hoursAgo(1),
      },
    ],
  },
};

export const AllDeleteActions: Story = {
  name: "All Delete Actions",
  args: {
    entries: [
      {
        _id: "audit-d-001",
        action: "delete",
        entityType: "risk",
        entityId: "risk-001",
        description: "Deleted risk: Legacy API compatibility concern (resolved)",
        userName: "Sarah Chen",
        timestamp: minutesAgo(10),
      },
      {
        _id: "audit-d-002",
        action: "delete",
        entityType: "task",
        entityId: "task-001",
        description: "Deleted duplicate task: Order validation stub",
        userName: "Alex Kim",
        timestamp: minutesAgo(45),
      },
    ],
  },
};

export const MixedEntityTypes: Story = {
  name: "Mixed Entity Types",
  args: {
    entries: [
      {
        _id: "audit-m-001",
        action: "create",
        entityType: "program",
        entityId: "prog-001",
        description: "Created program",
        userName: "Alex Kim",
        timestamp: minutesAgo(1),
      },
      {
        _id: "audit-m-002",
        action: "update",
        entityType: "requirement",
        entityId: "req-001",
        description: "Updated requirement priority",
        userName: "Sarah Chen",
        timestamp: minutesAgo(10),
      },
      {
        _id: "audit-m-003",
        action: "create",
        entityType: "risk",
        entityId: "risk-001",
        description: "Created risk: Data migration window",
        userName: "Jordan Park",
        timestamp: minutesAgo(20),
      },
      {
        _id: "audit-m-004",
        action: "status_change",
        entityType: "task",
        entityId: "task-001",
        description: "Task marked complete",
        userName: "Taylor Wong",
        timestamp: minutesAgo(30),
      },
      {
        _id: "audit-m-005",
        action: "update",
        entityType: "skill",
        entityId: "skill-001",
        description: "Updated skill content",
        userName: "Alex Kim",
        timestamp: hoursAgo(1),
      },
      {
        _id: "audit-m-006",
        action: "status_change",
        entityType: "gate",
        entityId: "gate-001",
        description: "Sprint gate passed",
        userName: "Sarah Chen",
        timestamp: hoursAgo(2),
      },
      {
        _id: "audit-m-007",
        action: "create",
        entityType: "integration",
        entityId: "intg-001",
        description: "Connected Jira workspace",
        userName: "Jordan Park",
        timestamp: hoursAgo(3),
      },
      {
        _id: "audit-m-008",
        action: "create",
        entityType: "document",
        entityId: "doc-001",
        description: "Uploaded requirements document",
        userName: "Taylor Wong",
        timestamp: hoursAgo(4),
      },
    ],
  },
};

export const SingleEntry: Story = {
  name: "Single Entry",
  args: {
    entries: [
      {
        _id: "audit-single-001",
        action: "create",
        entityType: "program",
        entityId: "prog-001",
        description: "Created program: AcmeCorp Migration",
        userName: "Alex Kim",
        timestamp: minutesAgo(2),
      },
    ],
  },
};

export const Mobile: Story = {
  args: {
    entries: todayEntries.slice(0, 3),
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const Tablet: Story = {
  args: {
    entries: allEntries,
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
