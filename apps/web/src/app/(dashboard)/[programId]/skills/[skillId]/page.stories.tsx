import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SkillDetailPage from "./page";

const meta = {
  title: "Pages/Skills/Detail",
  component: SkillDetailPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/skills/skill-1",
        params: { programId: "prog-acme-demo", skillId: "skill-1" },
      },
    },
    convexMockData: {
      "skills:get": {
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
        content:
          "# Apex Development Standards\n\n## Overview\n\nThis skill defines the coding standards and best practices for Apex development in the AcmeCorp Salesforce B2B Commerce implementation.\n\n## Key Principles\n\n- Follow Salesforce governor limits at all times\n- Use bulk patterns for all trigger handlers\n- Implement proper error handling with custom exception classes\n- Write meaningful unit tests with >= 85% coverage\n\n## Trigger Framework\n\nAll triggers must use the TriggerHandler pattern:\n\n```apex\npublic class AccountTriggerHandler extends TriggerHandler {\n  public override void beforeInsert() {\n    // Implementation\n  }\n}\n```\n\n## SOQL Best Practices\n\n- Never use SOQL inside loops\n- Use selective queries with indexed fields\n- Leverage relationship queries to reduce query count\n\n## Error Handling\n\n- Create domain-specific exception classes\n- Log errors to custom object for monitoring\n- Use Database.SaveResult for partial success handling",
        resolvedRequirements: [
          { _id: "req-1", refId: "FOUND-12", title: "Product SKU Mapping" },
          { _id: "req-2", refId: "FOUND-15", title: "Category Hierarchy Migration" },
          { _id: "req-3", refId: "FOUND-23", title: "Order Data Validation Rules" },
        ],
      },
      "requirements:listByProgram": [
        { _id: "req-1", refId: "FOUND-12", title: "Product SKU Mapping" },
        { _id: "req-2", refId: "FOUND-15", title: "Category Hierarchy Migration" },
        { _id: "req-3", refId: "FOUND-23", title: "Order Data Validation Rules" },
        { _id: "req-4", refId: "FOUND-31", title: "Customer Account Sync" },
        { _id: "req-5", refId: "FOUND-42", title: "Pricing Tier Engine" },
        { _id: "req-6", refId: "FOUND-55", title: "Inventory Real-time Updates" },
      ],
    },
  },
} satisfies Meta<typeof SkillDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DraftSkill: Story = {
  parameters: {
    convexMockData: {
      ...meta.parameters.convexMockData,
      "skills:get": {
        ...meta.parameters.convexMockData["skills:get"],
        status: "draft",
        currentVersion: "v0.1",
        lineCount: 45,
        resolvedRequirements: [],
        content: "# New Skill Draft\n\n## Overview\n\nTODO: Add content here.",
      },
    },
  },
};

export const DeprecatedSkill: Story = {
  parameters: {
    convexMockData: {
      ...meta.parameters.convexMockData,
      "skills:get": {
        ...meta.parameters.convexMockData["skills:get"],
        status: "deprecated",
        name: "Legacy Code Review Checklist",
        domain: "review",
      },
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
