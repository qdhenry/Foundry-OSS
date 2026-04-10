import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { StepEditor } from "./StepEditor";

const mockWorkstreams = [
  { _id: "ws_001" as any, name: "Data Migration", shortCode: "DM" },
  { _id: "ws_002" as any, name: "Integration", shortCode: "INT" },
  { _id: "ws_003" as any, name: "Frontend", shortCode: "FE" },
  { _id: "ws_004" as any, name: "Platform Config", shortCode: "PC" },
  { _id: "ws_005" as any, name: "Testing & QA", shortCode: "QA" },
];

const populatedSteps = [
  {
    title: "Discovery & Requirements Gathering",
    description: "Collect and validate all business requirements from stakeholders.",
    workstreamId: "ws_001" as any,
    estimatedHours: 40,
  },
  {
    title: "Data Mapping & Cleansing",
    description: "Map source data entities to target platform schema.",
    workstreamId: "ws_001" as any,
    estimatedHours: 80,
  },
  {
    title: "Integration Architecture Design",
    description: "Design the integration layer between platform and external systems.",
    workstreamId: "ws_002" as any,
    estimatedHours: 60,
  },
  {
    title: "Sandbox Build & Testing",
    description: undefined,
    workstreamId: "ws_005" as any,
    estimatedHours: 120,
  },
  {
    title: "UAT & Sign-off",
    description: "User acceptance testing with client stakeholders.",
    workstreamId: undefined,
    estimatedHours: 40,
  },
];

const meta: Meta<typeof StepEditor> = {
  title: "Playbooks/StepEditor",
  component: StepEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    steps: populatedSteps,
    onChange: fn(),
    workstreams: mockWorkstreams,
  },
};

export default meta;
type Story = StoryObj<typeof StepEditor>;

export const WithSteps: Story = {
  name: "With Populated Steps",
};

export const Empty: Story = {
  name: "Empty — No Steps",
  args: {
    steps: [],
  },
};

export const SingleStep: Story = {
  name: "Single Step",
  args: {
    steps: [
      {
        title: "Discovery Phase",
        description: "Initial discovery and requirements gathering.",
        workstreamId: "ws_001" as any,
        estimatedHours: 40,
      },
    ],
  },
};

export const NoWorkstreams: Story = {
  name: "No Workstreams Available",
  args: {
    workstreams: [],
  },
};

export const AddStep: Story = {
  name: "Interactive — Add a Step",
  args: {
    steps: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addButton = canvas.getByRole("button", { name: /add step/i });
    await userEvent.click(addButton);
  },
};

export const TypeStepTitle: Story = {
  name: "Interactive — Type Step Title",
  args: {
    steps: [{ title: "" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const titleInput = canvas.getByPlaceholderText("Step title");
    await userEvent.click(titleInput);
    await userEvent.type(titleInput, "My New Step Title");
  },
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
