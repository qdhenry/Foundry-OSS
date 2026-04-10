import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "@storybook/test";
import { FoundryMark } from "./FoundryMark";

const meta = {
  title: "Brand/FoundryMark",
  component: FoundryMark,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    size: 48,
    variant: "dark",
  },
  argTypes: {
    size: {
      control: { type: "range", min: 16, max: 120, step: 4 },
      description: "Size in pixels (width). Height scales proportionally.",
    },
    variant: {
      control: "select",
      options: ["dark", "light", "slate", "mono-white", "mono-black", "flat"],
      description: "Color variant of the mark",
    },
  },
} satisfies Meta<typeof FoundryMark>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Visual Variants ---

export const Default: Story = {};

export const Dark: Story = {
  args: { variant: "dark" },
};

export const Light: Story = {
  args: { variant: "light" },
  parameters: {
    backgrounds: { default: "light" },
  },
};

export const Slate: Story = {
  args: { variant: "slate" },
  parameters: {
    backgrounds: { default: "light" },
  },
};

export const MonoWhite: Story = {
  args: { variant: "mono-white" },
};

export const MonoBlack: Story = {
  args: { variant: "mono-black" },
  parameters: {
    backgrounds: { default: "light" },
  },
};

export const Flat: Story = {
  args: { variant: "flat" },
};

// --- Size Variations ---

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "end", gap: "2rem" }}>
      {[16, 24, 32, 48, 64, 96].map((size) => (
        <div key={size} style={{ textAlign: "center" }}>
          <FoundryMark size={size} variant="dark" />
          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {size}px
          </div>
        </div>
      ))}
    </div>
  ),
};

// --- All Variants Gallery ---

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
      {(["dark", "light", "slate", "mono-white", "mono-black", "flat"] as const).map((variant) => (
        <div
          key={variant}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            padding: "1.5rem",
            borderRadius: "0.75rem",
            background: ["light", "slate", "mono-black"].includes(variant)
              ? "#f8fafc"
              : "var(--surface-default, #0a0e1a)",
            border: "1px solid var(--border-default, #1a2038)",
          }}
        >
          <FoundryMark size={48} variant={variant} />
          <span
            style={{
              fontSize: "0.75rem",
              fontFamily: "monospace",
              color: ["light", "slate", "mono-black"].includes(variant)
                ? "#475569"
                : "var(--text-secondary)",
            }}
          >
            {variant}
          </span>
        </div>
      ))}
    </div>
  ),
};

// --- Accessibility ---

export const AccessibilityCheck: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const svg = canvas.getByLabelText("Foundry mark");
    await expect(svg).toBeInTheDocument();
    await expect(svg.tagName.toLowerCase()).toBe("svg");
  },
};

// --- Responsive ---

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};

export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: "tablet" } },
};

export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: "desktop" } },
};
