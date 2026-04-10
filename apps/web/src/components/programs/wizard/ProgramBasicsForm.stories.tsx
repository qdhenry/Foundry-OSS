import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { type ProgramBasicsData, ProgramBasicsForm } from "./ProgramBasicsForm";

const defaultData: ProgramBasicsData = {
  name: "",
  clientName: "",
  engagementType: "",
  techStack: [],
  description: "",
  startDate: "",
  targetEndDate: "",
  workstreams: [],
};

const filledData: ProgramBasicsData = {
  name: "AcmeCorp B2B Migration",
  clientName: "AcmeCorp",
  engagementType: "migration",
  techStack: [
    { category: "commerce_platform", technologies: ["Salesforce Commerce"] },
    { category: "frontend", technologies: ["React", "Next.js"] },
  ],
  description: "Full platform migration from Magento 2 to Salesforce B2B Commerce.",
  startDate: "2026-03-01",
  targetEndDate: "2026-09-30",
  workstreams: [
    { name: "Discovery & Assessment", shortCode: "DA", sortOrder: 0 },
    { name: "Architecture & Design", shortCode: "AD", sortOrder: 1 },
    { name: "Core Implementation", shortCode: "CI", sortOrder: 2 },
    { name: "Data Migration", shortCode: "DM", sortOrder: 3 },
    { name: "Testing & Launch", shortCode: "TL", sortOrder: 4 },
  ],
};

const meta: Meta<typeof ProgramBasicsForm> = {
  title: "Programs/Wizard/ProgramBasicsForm",
  component: ProgramBasicsForm,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    data: defaultData,
    onChange: fn(),
    onNext: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ProgramBasicsForm>;

export const Empty: Story = {
  name: "Empty Form",
  args: {
    data: defaultData,
  },
};

export const Filled: Story = {
  name: "Filled Form",
  args: {
    data: filledData,
  },
};

export const GreenfieldEngagement: Story = {
  name: "Greenfield Engagement Type",
  args: {
    data: {
      ...filledData,
      engagementType: "greenfield",
      techStack: [
        { category: "frontend", technologies: ["React", "Next.js"] },
        { category: "backend", technologies: ["Node.js"] },
        { category: "cloud", technologies: ["AWS"] },
      ],
    },
  },
};

export const ValidationErrors: Story = {
  name: "Validation Errors (triggered)",
  args: {
    data: defaultData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nextButton = canvas.getByRole("button", { name: /next/i });
    await userEvent.click(nextButton);
  },
};

export const TypeIntoForm: Story = {
  name: "Interactive — Type Program Name",
  args: {
    data: defaultData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nameInput = canvas.getByPlaceholderText(/acme/i);
    await userEvent.click(nameInput);
    await userEvent.type(nameInput, "My New Delivery Program");
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  args: {
    data: filledData,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  args: {
    data: filledData,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
