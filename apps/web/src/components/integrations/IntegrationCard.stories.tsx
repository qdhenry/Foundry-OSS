import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { IntegrationCard } from "./IntegrationCard";

const meta: Meta<typeof IntegrationCard> = {
  title: "Integrations/IntegrationCard",
  component: IntegrationCard,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border-default">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">
                Systems
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">
                Requirements
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default bg-surface-default">
            <Story />
          </tbody>
        </table>
      </div>
    ),
  ],
  argTypes: {
    onClick: { action: "clicked" },
  },
};

export default meta;
type Story = StoryObj<typeof IntegrationCard>;

const baseIntegration = {
  _id: "int_001",
  name: "Customer Orders API",
  type: "api",
  sourceSystem: "Magento",
  targetSystem: "Salesforce B2B",
  status: "live",
  requirementIds: ["req_01", "req_02", "req_03"],
};

export const Default: Story = {
  args: {
    integration: baseIntegration,
  },
};

export const TypeAPI: Story = {
  name: "Type: API",
  args: {
    integration: {
      ...baseIntegration,
      type: "api",
      status: "live",
    },
  },
};

export const TypeWebhook: Story = {
  name: "Type: Webhook",
  args: {
    integration: {
      ...baseIntegration,
      name: "Order Status Webhook",
      type: "webhook",
      sourceSystem: "Salesforce B2B",
      targetSystem: "Internal Notify Service",
      status: "testing",
    },
  },
};

export const TypeFileTransfer: Story = {
  name: "Type: File Transfer",
  args: {
    integration: {
      ...baseIntegration,
      name: "Nightly Product Export",
      type: "file_transfer",
      sourceSystem: "Magento",
      targetSystem: "BigCommerce",
      status: "in_progress",
    },
  },
};

export const TypeDatabase: Story = {
  name: "Type: Database",
  args: {
    integration: {
      ...baseIntegration,
      name: "Customer DB Sync",
      type: "database",
      sourceSystem: "MySQL",
      targetSystem: "PostgreSQL",
      status: "planned",
    },
  },
};

export const TypeMiddleware: Story = {
  name: "Type: Middleware",
  args: {
    integration: {
      ...baseIntegration,
      name: "ESB Message Routing",
      type: "middleware",
      sourceSystem: "MuleSoft",
      targetSystem: "Salesforce B2B",
      status: "in_progress",
    },
  },
};

export const TypeOther: Story = {
  name: "Type: Other",
  args: {
    integration: {
      ...baseIntegration,
      name: "Legacy Connector",
      type: "other",
      sourceSystem: "Legacy ERP",
      targetSystem: "New Platform",
      status: "planned",
    },
  },
};

export const StatusPlanned: Story = {
  name: "Status: Planned",
  args: {
    integration: {
      ...baseIntegration,
      status: "planned",
      requirementIds: [],
    },
  },
};

export const StatusInProgress: Story = {
  name: "Status: In Progress",
  args: {
    integration: {
      ...baseIntegration,
      status: "in_progress",
      requirementIds: ["req_01"],
    },
  },
};

export const StatusTesting: Story = {
  name: "Status: Testing",
  args: {
    integration: {
      ...baseIntegration,
      status: "testing",
      requirementIds: ["req_01", "req_02"],
    },
  },
};

export const StatusLive: Story = {
  name: "Status: Live",
  args: {
    integration: {
      ...baseIntegration,
      status: "live",
    },
  },
};

export const StatusDeprecated: Story = {
  name: "Status: Deprecated",
  args: {
    integration: {
      ...baseIntegration,
      name: "Old Product Sync (v1)",
      status: "deprecated",
      requirementIds: [],
    },
  },
};

export const NoRequirements: Story = {
  name: "No Requirements",
  args: {
    integration: {
      ...baseIntegration,
      requirementIds: [],
    },
  },
};

export const LongSystemNames: Story = {
  name: "Long System Names",
  args: {
    integration: {
      ...baseIntegration,
      name: "Enterprise Integration Bridge for Legacy Commerce Platform Migration",
      sourceSystem: "Legacy Magento Enterprise Edition 1.x",
      targetSystem: "Salesforce B2B Commerce Cloud Platform",
      type: "middleware",
      status: "in_progress",
    },
  },
};

export const ClickInteraction: Story = {
  name: "Click Interaction",
  args: {
    integration: baseIntegration,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByText("Customer Orders API").closest("tr");
    if (row) {
      await userEvent.click(row);
      await expect(args.onClick).toHaveBeenCalled();
    }
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  args: {
    integration: baseIntegration,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  args: {
    integration: {
      ...baseIntegration,
      type: "webhook",
      status: "testing",
    },
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
