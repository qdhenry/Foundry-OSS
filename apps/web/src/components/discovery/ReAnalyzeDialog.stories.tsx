import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { ReAnalyzeDialog } from "./ReAnalyzeDialog";

const meta: Meta<typeof ReAnalyzeDialog> = {
  title: "Discovery/ReAnalyzeDialog",
  component: ReAnalyzeDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    isOpen: true,
    documentName: "Acme_RFP_2024.pdf",
    defaultTargetPlatform: "salesforce_b2b",
    onCancel: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReAnalyzeDialog>;

export const Default: Story = {
  name: "Default (Salesforce B2B)",
};

export const BigCommerceTarget: Story = {
  name: "BigCommerce B2B Target",
  args: {
    defaultTargetPlatform: "bigcommerce_b2b",
    documentName: "Architecture_Review_Q4.docx",
  },
};

export const LongDocumentName: Story = {
  name: "Long Document Name",
  args: {
    documentName: "Acme_Platform_Migration_Discovery_Workshop_Notes_Session_3_Final.pdf",
  },
};

export const Closed: Story = {
  name: "Closed (renders nothing)",
  args: {
    isOpen: false,
  },
};

export const FocusAreaRequirements: Story = {
  name: "Focus Area — Requirements (interaction)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const focusSelect = canvas.getByDisplayValue("All findings");
    await userEvent.selectOptions(focusSelect, "requirements");
  },
};

export const WithSuggestionSelected: Story = {
  name: "Suggestion Chip Selected (interaction)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const suggestion = canvas.getByText("Prioritize security and compliance risks");
    await userEvent.click(suggestion);
  },
};

export const WithCustomInstructions: Story = {
  name: "Custom Instructions Filled (interaction)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const focusSelect = canvas.getByDisplayValue("All findings");
    await userEvent.selectOptions(focusSelect, "risks");

    const platformSelect = canvas.getByDisplayValue("Salesforce B2B Commerce");
    await userEvent.selectOptions(platformSelect, "bigcommerce_b2b");

    const textarea = canvas.getByPlaceholderText("Optional instructions for the next run");
    await userEvent.type(
      textarea,
      "Focus specifically on data migration risks related to the 45,000 SKU product catalog and EDI integration dependencies with hospital procurement systems.",
    );
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
