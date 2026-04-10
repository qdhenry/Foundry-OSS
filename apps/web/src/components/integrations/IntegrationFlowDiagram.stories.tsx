import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IntegrationFlowDiagram } from "./IntegrationFlowDiagram";

const meta: Meta<typeof IntegrationFlowDiagram> = {
  title: "Integrations/IntegrationFlowDiagram",
  component: IntegrationFlowDiagram,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    type: {
      control: "select",
      options: ["api", "webhook", "file_transfer", "database", "middleware", "other"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof IntegrationFlowDiagram>;

export const Default: Story = {
  args: {
    sourceSystem: "Magento",
    targetSystem: "Salesforce B2B",
    type: "api",
  },
};

export const TypeAPI: Story = {
  name: "Type: API",
  args: {
    sourceSystem: "Magento",
    targetSystem: "Salesforce B2B Commerce",
    type: "api",
  },
};

export const TypeWebhook: Story = {
  name: "Type: Webhook",
  args: {
    sourceSystem: "Salesforce B2B",
    targetSystem: "Internal Notify Service",
    type: "webhook",
  },
};

export const TypeFileTransfer: Story = {
  name: "Type: File Transfer",
  args: {
    sourceSystem: "Magento",
    targetSystem: "BigCommerce",
    type: "file_transfer",
  },
};

export const TypeDatabase: Story = {
  name: "Type: Database",
  args: {
    sourceSystem: "MySQL 5.7",
    targetSystem: "PostgreSQL 15",
    type: "database",
  },
};

export const TypeMiddleware: Story = {
  name: "Type: Middleware",
  args: {
    sourceSystem: "MuleSoft ESB",
    targetSystem: "Salesforce B2B",
    type: "middleware",
  },
};

export const TypeOther: Story = {
  name: "Type: Other",
  args: {
    sourceSystem: "Legacy ERP",
    targetSystem: "New Platform",
    type: "other",
  },
};

export const LongSystemNames: Story = {
  name: "Long System Names",
  args: {
    sourceSystem: "Legacy Magento Enterprise Edition 1.14",
    targetSystem: "Salesforce B2B Commerce Cloud Spring 24",
    type: "middleware",
  },
};

export const ShortSystemNames: Story = {
  name: "Short System Names",
  args: {
    sourceSystem: "ERP",
    targetSystem: "CRM",
    type: "api",
  },
};

export const UnknownType: Story = {
  name: "Unknown / Fallback Type",
  args: {
    sourceSystem: "System A",
    targetSystem: "System B",
    type: "custom_type",
  },
};

export const AllTypesShowcase: Story = {
  name: "All Types Showcase",
  render: () => (
    <div className="space-y-6">
      {(
        [
          { type: "api", source: "Magento", target: "Salesforce B2B" },
          { type: "webhook", source: "Salesforce", target: "Notification Svc" },
          { type: "file_transfer", source: "Magento", target: "BigCommerce" },
          { type: "database", source: "MySQL", target: "PostgreSQL" },
          { type: "middleware", source: "MuleSoft", target: "Salesforce" },
          { type: "other", source: "Legacy ERP", target: "New Platform" },
        ] as const
      ).map(({ type, source, target }) => (
        <div key={type} className="rounded-lg border border-border-default bg-surface-default">
          <div className="border-b border-border-default px-4 py-2">
            <span className="text-xs font-medium text-text-secondary capitalize">
              {type.replace("_", " ")}
            </span>
          </div>
          <IntegrationFlowDiagram sourceSystem={source} targetSystem={target} type={type} />
        </div>
      ))}
    </div>
  ),
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  args: {
    sourceSystem: "Magento",
    targetSystem: "Salesforce B2B",
    type: "api",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  args: {
    sourceSystem: "Magento Enterprise",
    targetSystem: "BigCommerce B2B",
    type: "file_transfer",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
