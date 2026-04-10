import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { FindingsPagination } from "./FindingsPagination";

const meta: Meta<typeof FindingsPagination> = {
  title: "Discovery/FindingsPagination",
  component: FindingsPagination,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onPageChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof FindingsPagination>;

// ── Stories ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    currentPage: 0,
    totalPages: 5,
  },
};

export const FirstPage: Story = {
  name: "First Page (Previous disabled)",
  args: {
    currentPage: 0,
    totalPages: 5,
  },
};

export const MiddlePage: Story = {
  name: "Middle Page (both buttons enabled)",
  args: {
    currentPage: 2,
    totalPages: 5,
  },
};

export const LastPage: Story = {
  name: "Last Page (Next disabled)",
  args: {
    currentPage: 4,
    totalPages: 5,
  },
};

export const TwoPages: Story = {
  name: "Two Pages Total",
  args: {
    currentPage: 0,
    totalPages: 2,
  },
};

export const SinglePage: Story = {
  name: "Single Page (renders nothing)",
  args: {
    currentPage: 0,
    totalPages: 1,
  },
};

export const LargePageCount: Story = {
  name: "Large Page Count (12 pages)",
  args: {
    currentPage: 5,
    totalPages: 12,
  },
};

export const NextPageAction: Story = {
  name: "Interaction — Click Next",
  args: {
    currentPage: 1,
    totalPages: 5,
    onPageChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const nextBtn = canvas.getByRole("button", { name: /next/i });
    await expect(nextBtn).not.toBeDisabled();
    await userEvent.click(nextBtn);
    await expect(args.onPageChange).toHaveBeenCalledWith(2);
  },
};

export const PreviousPageAction: Story = {
  name: "Interaction — Click Previous",
  args: {
    currentPage: 3,
    totalPages: 5,
    onPageChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const prevBtn = canvas.getByRole("button", { name: /previous/i });
    await expect(prevBtn).not.toBeDisabled();
    await userEvent.click(prevBtn);
    await expect(args.onPageChange).toHaveBeenCalledWith(2);
  },
};

export const PreviousDisabledOnFirstPage: Story = {
  name: "Interaction — Previous Disabled on First Page",
  args: {
    currentPage: 0,
    totalPages: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const prevBtn = canvas.getByRole("button", { name: /previous/i });
    await expect(prevBtn).toBeDisabled();
  },
};

export const NextDisabledOnLastPage: Story = {
  name: "Interaction — Next Disabled on Last Page",
  args: {
    currentPage: 4,
    totalPages: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nextBtn = canvas.getByRole("button", { name: /next/i });
    await expect(nextBtn).toBeDisabled();
  },
};

export const Mobile: Story = {
  args: {
    currentPage: 2,
    totalPages: 5,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    currentPage: 2,
    totalPages: 8,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
