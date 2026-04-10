import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SkillsPage from "./page";

const meta = {
  title: "Pages/Skills/List",
  component: SkillsPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    convexMockData: {
      "skills:listByProgram": [
        {
          _id: "skill-1",
          _creationTime: Date.now() - 10 * 86400000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo",
          name: "Apex Development Standards",
          domain: "backend",
          targetPlatform: "salesforce_b2b",
          currentVersion: "v2.1",
          status: "active",
          lineCount: 342,
          linkedRequirements: ["req-1", "req-2", "req-3"],
          content: "# Apex Development Standards\n\n...",
        },
        {
          _id: "skill-2",
          _creationTime: Date.now() - 7 * 86400000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo",
          name: "React Component Architecture",
          domain: "frontend",
          targetPlatform: "platform_agnostic",
          currentVersion: "v1.0",
          status: "active",
          lineCount: 218,
          linkedRequirements: ["req-4"],
          content: "# React Component Architecture\n\n...",
        },
        {
          _id: "skill-3",
          _creationTime: Date.now() - 5 * 86400000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo",
          name: "B2B Commerce Integration Patterns",
          domain: "integration",
          targetPlatform: "salesforce_b2b",
          currentVersion: "v1.3",
          status: "active",
          lineCount: 510,
          linkedRequirements: ["req-1", "req-5"],
          content: "# B2B Commerce Integration Patterns\n\n...",
        },
        {
          _id: "skill-4",
          _creationTime: Date.now() - 3 * 86400000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo",
          name: "Salesforce Deployment Pipeline",
          domain: "deployment",
          targetPlatform: "salesforce_b2b",
          currentVersion: "v0.9",
          status: "draft",
          lineCount: 156,
          linkedRequirements: [],
          content: "# Salesforce Deployment Pipeline\n\n...",
        },
        {
          _id: "skill-5",
          _creationTime: Date.now() - 2 * 86400000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo",
          name: "Data Migration Testing",
          domain: "testing",
          targetPlatform: "platform_agnostic",
          currentVersion: "v1.1",
          status: "active",
          lineCount: 289,
          linkedRequirements: ["req-2", "req-3"],
          content: "# Data Migration Testing\n\n...",
        },
        {
          _id: "skill-6",
          _creationTime: Date.now() - 1 * 86400000,
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo",
          name: "Legacy Code Review Checklist",
          domain: "review",
          targetPlatform: "platform_agnostic",
          currentVersion: "v2.0",
          status: "deprecated",
          lineCount: 97,
          linkedRequirements: [],
          content: "# Legacy Code Review Checklist\n\n...",
        },
        {
          _id: "skill-7",
          _creationTime: Date.now(),
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo",
          name: "Solution Architecture Template",
          domain: "architecture",
          targetPlatform: "salesforce_b2b",
          currentVersion: "v1.0",
          status: "active",
          lineCount: 425,
          linkedRequirements: ["req-1", "req-2", "req-4", "req-5"],
          content: "# Solution Architecture Template\n\n...",
        },
        {
          _id: "skill-8",
          _creationTime: Date.now(),
          orgId: "org_foundry_demo",
          programId: "prog-acme-demo",
          name: "BigCommerce B2B Catalog Sync",
          domain: "backend",
          targetPlatform: "bigcommerce_b2b",
          currentVersion: "v1.0",
          status: "draft",
          lineCount: 183,
          linkedRequirements: ["req-6"],
          content: "# BigCommerce B2B Catalog Sync\n\n...",
        },
      ],
    },
  },
} satisfies Meta<typeof SkillsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "skills:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
