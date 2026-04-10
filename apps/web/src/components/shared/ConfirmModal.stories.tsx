import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { useState } from "react";
import { ConfirmModal } from "./ConfirmModal";

// ── Meta ─────────────────────────────────────────────────────────────

const meta: Meta<typeof ConfirmModal> = {
  title: "Shared/ConfirmModal",
  component: ConfirmModal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    title: "Confirm action",
    description: "Are you sure you want to proceed? This action cannot be undone.",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    tone: "neutral",
    isLoading: false,
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmModal>;

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {};

export const Danger: Story = {
  args: {
    title: "Delete sandbox session",
    description:
      "Permanently delete this sandbox session and all its logs/messages? This cannot be undone.",
    confirmLabel: "Delete",
    tone: "danger",
  },
};

export const BulkDelete: Story = {
  args: {
    title: "Delete 5 sandbox sessions",
    description:
      "Permanently delete 5 sandbox sessions and all associated logs/messages? This cannot be undone.",
    confirmLabel: "Delete all",
    tone: "danger",
  },
};

export const Loading: Story = {
  args: {
    ...Danger.args,
    isLoading: true,
  },
};

export const Mobile: Story = {
  args: {
    ...Danger.args,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    ...Danger.args,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const ClickCancel: Story = {
  args: {
    onClose: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const cancelButton = canvas.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const ClickConfirm: Story = {
  args: {
    onConfirm: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const confirmButton = canvas.getByRole("button", { name: /confirm/i });
    await userEvent.click(confirmButton);
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const Interactive: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div>
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-lg bg-status-error-fg px-3 py-2 text-sm font-medium text-white"
        >
          Delete sandbox
        </button>
        <ConfirmModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onConfirm={() => setIsOpen(false)}
          title="Delete sandbox session"
          description="Permanently delete this sandbox session and all its logs/messages? This cannot be undone."
          confirmLabel="Delete"
          tone="danger"
        />
      </div>
    );
  },
};
