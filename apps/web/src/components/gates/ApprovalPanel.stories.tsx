import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { ApprovalPanel } from "./ApprovalPanel";

const meta: Meta<typeof ApprovalPanel> = {
  title: "Gates/ApprovalPanel",
  component: ApprovalPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    gateId: { control: "text" },
    isEditable: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof ApprovalPanel>;

// ─── Shared mock data ────────────────────────────────────────────────────────

const approvalPending = {
  userId: "user_01",
  role: "Engineering Lead",
  status: "pending" as const,
  userName: "Alexis Carter",
};

const approvalApproved = {
  userId: "user_02",
  role: "Product Manager",
  status: "approved" as const,
  timestamp: new Date("2026-02-10T14:22:00Z").getTime(),
  userName: "Jordan Lee",
};

const approvalDeclined = {
  userId: "user_03",
  role: "QA Lead",
  status: "declined" as const,
  timestamp: new Date("2026-02-11T09:05:00Z").getTime(),
  userName: "Morgan Kim",
};

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Empty: Story = {
  args: {
    gateId: "gate_001",
    approvals: [],
    isEditable: false,
  },
};

export const EmptyEditable: Story = {
  args: {
    gateId: "gate_001",
    approvals: [],
    isEditable: true,
  },
};

export const AllPending: Story = {
  args: {
    gateId: "gate_002",
    approvals: [
      approvalPending,
      { userId: "user_04", role: "Architect", status: "pending" as const, userName: "Sam Rivera" },
    ],
    isEditable: false,
  },
};

export const AllPendingEditable: Story = {
  args: {
    gateId: "gate_002",
    approvals: [approvalPending],
    isEditable: true,
  },
};

export const AllApproved: Story = {
  args: {
    gateId: "gate_003",
    approvals: [
      approvalApproved,
      {
        userId: "user_05",
        role: "Engineering Lead",
        status: "approved" as const,
        timestamp: new Date("2026-02-12T11:00:00Z").getTime(),
        userName: "Taylor Brooks",
      },
    ],
    isEditable: false,
  },
};

export const Declined: Story = {
  args: {
    gateId: "gate_004",
    approvals: [approvalDeclined],
    isEditable: false,
  },
};

export const MixedStatuses: Story = {
  args: {
    gateId: "gate_005",
    approvals: [approvalApproved, approvalPending, approvalDeclined],
    isEditable: false,
  },
};

export const MixedStatusesEditable: Story = {
  args: {
    gateId: "gate_005",
    approvals: [approvalApproved, approvalPending, approvalDeclined],
    isEditable: true,
  },
};

// ─── Interactive: open add-approval form ─────────────────────────────────────

export const AddApprovalFlow: Story = {
  args: {
    gateId: "gate_006",
    approvals: [],
    isEditable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addButton = await canvas.findByRole("button", { name: /add approval/i });
    await userEvent.click(addButton);

    const input = await canvas.findByPlaceholderText(/role \(e\.g\./i);
    await userEvent.type(input, "Security Reviewer");

    const submitButton = await canvas.findByRole("button", { name: /^add$/i });
    await expect(submitButton).not.toBeDisabled();
  },
};

export const CancelAddApprovalForm: Story = {
  args: {
    gateId: "gate_007",
    approvals: [],
    isEditable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addButton = await canvas.findByRole("button", { name: /add approval/i });
    await userEvent.click(addButton);

    const cancelButton = await canvas.findByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);

    await expect(canvas.queryByPlaceholderText(/role \(e\.g\./i)).toBeNull();
  },
};

// ─── Responsive viewports ─────────────────────────────────────────────────────

export const Mobile: Story = {
  args: {
    gateId: "gate_008",
    approvals: [approvalApproved, approvalPending],
    isEditable: true,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    gateId: "gate_009",
    approvals: [approvalApproved, approvalPending, approvalDeclined],
    isEditable: false,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
