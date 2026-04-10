import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlaybookCard } from "./PlaybookCard";

const basePlaybook = {
  _id: "playbook_001",
  name: "Magento to Salesforce B2B Migration Playbook",
  description:
    "A comprehensive step-by-step playbook for migrating from Magento 2 to Salesforce B2B Commerce, covering data migration, integration setup, and go-live.",
  targetPlatform: "salesforce_b2b" as const,
  steps: [
    { title: "Discovery & Requirements Gathering" },
    { title: "Data Mapping & Cleansing" },
    { title: "Integration Architecture Design" },
    { title: "Sandbox Build & Testing" },
    { title: "UAT & Sign-off" },
    { title: "Go-Live & Hypercare" },
  ],
  status: "published" as const,
};

const meta: Meta<typeof PlaybookCard> = {
  title: "Playbooks/PlaybookCard",
  component: PlaybookCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    playbook: basePlaybook,
    programId: "program_demo_001",
  },
};

export default meta;
type Story = StoryObj<typeof PlaybookCard>;

export const Published: Story = {
  name: "Published — Salesforce B2B",
};

export const Draft: Story = {
  name: "Draft Status",
  args: {
    playbook: {
      ...basePlaybook,
      _id: "playbook_002",
      name: "BigCommerce B2B Migration Playbook",
      targetPlatform: "bigcommerce_b2b",
      status: "draft",
      steps: [
        { title: "Discovery Phase" },
        { title: "Platform Configuration" },
        { title: "Data Migration" },
      ],
    },
  },
};

export const Archived: Story = {
  name: "Archived Status",
  args: {
    playbook: {
      ...basePlaybook,
      _id: "playbook_003",
      name: "Legacy Sitecore Migration Playbook",
      targetPlatform: "sitecore",
      status: "archived",
      description: "Deprecated playbook for Sitecore migrations.",
      steps: [{ title: "Assessment" }, { title: "Migration" }],
    },
  },
};

export const PlatformAgnostic: Story = {
  name: "Platform Agnostic",
  args: {
    playbook: {
      ...basePlaybook,
      _id: "playbook_004",
      name: "General Delivery Readiness Playbook",
      targetPlatform: "platform_agnostic",
      status: "published",
      description: "Platform-agnostic delivery framework applicable to any migration project.",
      steps: [
        { title: "Stakeholder Alignment" },
        { title: "Technical Discovery" },
        { title: "Risk Assessment" },
        { title: "Delivery Planning" },
      ],
    },
  },
};

export const NoDescription: Story = {
  name: "No Description",
  args: {
    playbook: {
      ...basePlaybook,
      description: undefined,
    },
  },
};

export const SingleStep: Story = {
  name: "Single Step",
  args: {
    playbook: {
      ...basePlaybook,
      steps: [{ title: "Only Step" }],
    },
  },
};

export const LongName: Story = {
  name: "Long Playbook Name",
  args: {
    playbook: {
      ...basePlaybook,
      name: "Enterprise-Scale Multi-Tenant B2B Commerce Platform Migration from Magento 2 Enterprise to Salesforce B2B Commerce Cloud with Custom Integrations",
    },
  },
};

export const GridLayout: Story = {
  name: "Grid — Multiple Cards",
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <PlaybookCard {...args} playbook={{ ...basePlaybook, status: "published" }} />
      <PlaybookCard
        {...args}
        playbook={{
          ...basePlaybook,
          _id: "playbook_002",
          name: "BigCommerce B2B Playbook",
          targetPlatform: "bigcommerce_b2b",
          status: "draft",
          steps: [{ title: "Step 1" }, { title: "Step 2" }],
        }}
      />
      <PlaybookCard
        {...args}
        playbook={{
          ...basePlaybook,
          _id: "playbook_003",
          name: "General Delivery Playbook",
          targetPlatform: "platform_agnostic",
          status: "published",
          description: undefined,
          steps: [{ title: "Step 1" }],
        }}
      />
    </div>
  ),
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
