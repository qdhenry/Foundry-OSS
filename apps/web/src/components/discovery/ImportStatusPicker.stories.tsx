import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { ImportStatusPicker } from "./ImportStatusPicker";

const meta: Meta<typeof ImportStatusPicker> = {
  title: "Discovery/ImportStatusPicker",
  component: ImportStatusPicker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ImportStatusPicker>;

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    value: "draft",
    disabled: false,
  },
};

export const Draft: Story = {
  args: {
    value: "draft",
    disabled: false,
  },
};

export const Active: Story = {
  args: {
    value: "active",
    disabled: false,
  },
};

export const Deferred: Story = {
  args: {
    value: "deferred",
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    value: "draft",
    disabled: true,
  },
};

export const DisabledActive: Story = {
  name: "Disabled — Active Value",
  args: {
    value: "active",
    disabled: true,
  },
};

export const ChangeToActive: Story = {
  name: "Interaction — Change to Active",
  args: {
    value: "draft",
    disabled: false,
    onChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("combobox");
    await expect(select).toBeInTheDocument();
    await userEvent.selectOptions(select, "active");
    await expect(args.onChange).toHaveBeenCalledWith("active");
  },
};

export const ChangeToDeferred: Story = {
  name: "Interaction — Change to Deferred",
  args: {
    value: "active",
    disabled: false,
    onChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("combobox");
    await userEvent.selectOptions(select, "deferred");
    await expect(args.onChange).toHaveBeenCalledWith("deferred");
  },
};

export const DisabledCannotChange: Story = {
  name: "Interaction — Disabled (cannot change)",
  args: {
    value: "draft",
    disabled: true,
    onChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("combobox");
    await expect(select).toBeDisabled();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const Mobile: Story = {
  args: {
    value: "draft",
    disabled: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
