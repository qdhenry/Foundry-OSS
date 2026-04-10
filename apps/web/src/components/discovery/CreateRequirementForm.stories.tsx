import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { CreateRequirementForm } from "./CreateRequirementForm";

// CreateRequirementForm uses useMutation from convex/react and useOrganization from @clerk/nextjs.
// Both are mocked globally by the Storybook setup.

const mockWorkstreams = [
  { _id: "ws-1", name: "Catalog & PIM" },
  { _id: "ws-2", name: "Checkout & Payments" },
  { _id: "ws-3", name: "Order Management" },
  { _id: "ws-4", name: "Customer Accounts" },
  { _id: "ws-5", name: "Reporting & Analytics" },
  { _id: "ws-6", name: "Integrations" },
  { _id: "ws-7", name: "Platform Infrastructure" },
];

const meta: Meta<typeof CreateRequirementForm> = {
  title: "Discovery/CreateRequirementForm",
  component: CreateRequirementForm,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    programId: "prog-acme-corp",
    workstreams: mockWorkstreams,
    isOpen: true,
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CreateRequirementForm>;

export const Default: Story = {
  name: "Default (Open)",
};

export const Closed: Story = {
  name: "Closed (renders nothing)",
  args: {
    isOpen: false,
  },
};

export const NoWorkstreams: Story = {
  name: "No Workstreams Available",
  args: {
    workstreams: [],
  },
};

export const FilledOut: Story = {
  name: "Form Filled Out (interaction)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const titleInput = canvas.getByPlaceholderText("e.g. Product catalog data migration");
    await userEvent.type(titleInput, "Salesforce B2B product catalog migration for AcmeCorp");

    const descriptionInput = canvas.getByPlaceholderText("Detailed requirement description...");
    await userEvent.type(
      descriptionInput,
      "Migrate all 45,000 AcmeCorp product SKUs from Magento to Salesforce B2B Commerce, including pricing rules, tiered discounts, and product hierarchy.",
    );

    const batchInput = canvas.getByPlaceholderText("e.g. Batch 1");
    await userEvent.type(batchInput, "Batch 1");
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
