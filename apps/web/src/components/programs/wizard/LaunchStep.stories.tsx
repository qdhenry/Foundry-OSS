import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { LaunchStep } from "./LaunchStep";

const approvedFindings = [
  { _id: "f1", type: "requirement", status: "approved" },
  { _id: "f2", type: "requirement", status: "approved" },
  { _id: "f3", type: "requirement", status: "edited" },
  { _id: "f4", type: "risk", status: "approved" },
  { _id: "f5", type: "risk", status: "approved" },
  { _id: "f6", type: "integration", status: "approved" },
  { _id: "f7", type: "decision", status: "approved" },
  { _id: "f8", type: "requirement", status: "rejected" },
  { _id: "f9", type: "requirement", status: "pending" },
];

const meta: Meta<typeof LaunchStep> = {
  title: "Programs/Wizard/LaunchStep",
  component: LaunchStep,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    convex: {
      "discoveryFindings.listByProgram": approvedFindings,
      "programs.get": {
        _id: "program_demo_001",
        name: "AcmeCorp B2B Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
      },
      "sourceControl.installations.listByOrg": [],
    },
  },
  args: {
    programId: "program_demo_001",
    onLaunch: fn(),
    onBack: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof LaunchStep>;

export const ReadyToLaunch: Story = {
  name: "Ready to Launch — With Findings",
};

export const NoFindings: Story = {
  name: "No Approved Findings",
  parameters: {
    convex: {
      "discoveryFindings.listByProgram": [
        { _id: "f1", type: "requirement", status: "rejected" },
        { _id: "f2", type: "risk", status: "pending" },
      ],
      "programs.get": {
        _id: "program_demo_001",
        name: "AcmeCorp B2B Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
      },
      "sourceControl.installations.listByOrg": [],
    },
  },
};

export const WithGitHubInstallation: Story = {
  name: "With GitHub App — Repo Provisioning Shown",
  parameters: {
    convex: {
      "discoveryFindings.listByProgram": approvedFindings,
      "programs.get": {
        _id: "program_demo_001",
        name: "AcmeCorp B2B Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
      },
      "sourceControl.installations.listByOrg": [
        {
          installationId: 12345,
          accountLogin: "acme-corp",
          status: "active",
        },
      ],
    },
  },
};

export const BigCommerceTarget: Story = {
  name: "BigCommerce Target — No Repo Provisioning",
  parameters: {
    convex: {
      "discoveryFindings.listByProgram": approvedFindings,
      "programs.get": {
        _id: "program_demo_001",
        name: "AcmeCorp BigCommerce Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "bigcommerce_b2b",
      },
      "sourceControl.installations.listByOrg": [
        {
          installationId: 12345,
          accountLogin: "acme-corp",
          status: "active",
        },
      ],
    },
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "discoveryFindings.listByProgram": approvedFindings,
      "programs.get": {
        _id: "program_demo_001",
        name: "AcmeCorp B2B Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
      },
      "sourceControl.installations.listByOrg": [],
    },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "discoveryFindings.listByProgram": approvedFindings,
      "programs.get": {
        _id: "program_demo_001",
        name: "AcmeCorp B2B Migration",
        clientName: "AcmeCorp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
      },
      "sourceControl.installations.listByOrg": [],
    },
  },
};
