import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { ProvisionFromTemplate } from "./ProvisionFromTemplate";

const meta: Meta<typeof ProvisionFromTemplate> = {
  title: "SourceControl/ProvisionFromTemplate",
  component: ProvisionFromTemplate,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog_acme_corp" as any,
    clientName: "AcmeCorp",
    installationId: "inst_gh_12345",
    owner: "acme-corp",
    templateRepoFullName: "foundry-agency/sf-b2b-template",
    onSuccess: (result) => console.log("Provisioned:", result),
    onSkip: () => console.log("Skipped"),
  },
};

export default meta;
type Story = StoryObj<typeof ProvisionFromTemplate>;

export const Default: Story = {};

export const ShortClientName: Story = {
  args: {
    clientName: "Acme",
  },
};

export const LongClientName: Story = {
  args: {
    clientName: "Pacific Northwest Industries",
  },
};

export const WithoutSkipOption: Story = {
  args: {
    onSkip: undefined,
  },
};

export const FilledWithIntegrations: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Change ERP to NetSuite
    const erpSelect = canvas.getByLabelText(/erp system/i);
    await userEvent.selectOptions(erpSelect, "NetSuite");

    // Change CPQ to Salesforce CPQ
    const cpqSelect = canvas.getByLabelText(/cpq system/i);
    await userEvent.selectOptions(cpqSelect, "Salesforce CPQ");

    // Change tax to Avalara
    const taxSelect = canvas.getByLabelText(/tax system/i);
    await userEvent.selectOptions(taxSelect, "Avalara");

    // Change payment to Adyen
    const paymentSelect = canvas.getByLabelText(/payment gateway/i);
    await userEvent.selectOptions(paymentSelect, "Adyen");
  },
};

export const SuccessState: Story = {
  // Simulate the success state by providing a mock that resolves
  parameters: {
    convex: {
      "sourceControl.provisioning.provisionFromTemplate": {
        repoUrl: "https://github.com/acme-corp/acme-corp-sf-b2b",
        repoFullName: "acme-corp/acme-corp-sf-b2b",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const createBtn = canvas.getByRole("button", { name: /create repository/i });
    await userEvent.click(createBtn);
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
