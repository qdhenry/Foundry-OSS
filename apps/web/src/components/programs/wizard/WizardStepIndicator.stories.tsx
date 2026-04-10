import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WizardStepIndicator } from "./WizardStepIndicator";

const WIZARD_STEPS = [
  "Program Basics",
  "Upload Documents",
  "AI Analysis",
  "Review Findings",
  "Launch",
];

const meta: Meta<typeof WizardStepIndicator> = {
  title: "Programs/Wizard/WizardStepIndicator",
  component: WizardStepIndicator,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    steps: WIZARD_STEPS,
    currentStep: 0,
    completedSteps: [],
  },
};

export default meta;
type Story = StoryObj<typeof WizardStepIndicator>;

export const Step1Active: Story = {
  name: "Step 1 — Program Basics (active)",
  args: {
    currentStep: 0,
    completedSteps: [],
  },
};

export const Step2Active: Story = {
  name: "Step 2 — Upload Documents (active)",
  args: {
    currentStep: 1,
    completedSteps: [0],
  },
};

export const Step3Active: Story = {
  name: "Step 3 — AI Analysis (active)",
  args: {
    currentStep: 2,
    completedSteps: [0, 1],
  },
};

export const Step4Active: Story = {
  name: "Step 4 — Review Findings (active)",
  args: {
    currentStep: 3,
    completedSteps: [0, 1, 2],
  },
};

export const Step5Active: Story = {
  name: "Step 5 — Launch (active)",
  args: {
    currentStep: 4,
    completedSteps: [0, 1, 2, 3],
  },
};

export const AllCompleted: Story = {
  name: "All Steps Completed",
  args: {
    currentStep: 4,
    completedSteps: [0, 1, 2, 3, 4],
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  args: {
    currentStep: 2,
    completedSteps: [0, 1],
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  args: {
    currentStep: 2,
    completedSteps: [0, 1],
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
