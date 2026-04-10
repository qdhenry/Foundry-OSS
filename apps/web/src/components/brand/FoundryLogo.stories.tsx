import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "@storybook/test";
import { FoundryLogo } from "./FoundryLogo";

const meta = {
  title: "Brand/FoundryLogo",
  component: FoundryLogo,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    size: "md",
    variant: "auto",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Logo size preset",
    },
    variant: {
      control: "select",
      options: ["auto", "dark", "light", "slate", "mono-white", "mono-black", "flat"],
      description: "Color variant. 'auto' detects light/dark mode.",
    },
  },
} satisfies Meta<typeof FoundryLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Visual Variants ---

export const Default: Story = {};

export const AutoVariant: Story = {
  args: { variant: "auto" },
};

export const DarkVariant: Story = {
  args: { variant: "dark" },
};

export const LightVariant: Story = {
  args: { variant: "light" },
  parameters: {
    backgrounds: { default: "light" },
  },
};

export const SlateVariant: Story = {
  args: { variant: "slate" },
  parameters: {
    backgrounds: { default: "light" },
  },
};

export const MonoWhiteVariant: Story = {
  args: { variant: "mono-white" },
};

export const MonoBlackVariant: Story = {
  args: { variant: "mono-black" },
  parameters: {
    backgrounds: { default: "light" },
  },
};

export const FlatVariant: Story = {
  args: { variant: "flat" },
};

// --- Size Variations ---

export const Small: Story = {
  args: { size: "sm" },
};

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <div key={size} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontFamily: "monospace",
              color: "var(--text-muted)",
              width: "2rem",
            }}
          >
            {size}
          </span>
          <FoundryLogo size={size} variant="dark" />
        </div>
      ))}
    </div>
  ),
};

// --- All Variants Gallery ---

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem" }}>
      {(["auto", "dark", "light", "slate", "mono-white", "mono-black", "flat"] as const).map(
        (variant) => (
          <div
            key={variant}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "1.25rem",
              borderRadius: "0.75rem",
              background: ["light", "slate", "mono-black"].includes(variant)
                ? "#f8fafc"
                : "var(--surface-default, #0a0e1a)",
              border: "1px solid var(--border-default, #1a2038)",
            }}
          >
            <FoundryLogo size="md" variant={variant} />
            <span
              style={{
                fontSize: "0.7rem",
                fontFamily: "monospace",
                color: ["light", "slate", "mono-black"].includes(variant)
                  ? "#94a3b8"
                  : "var(--text-muted)",
              }}
            >
              {variant}
            </span>
          </div>
        ),
      )}
    </div>
  ),
};

// --- Accessibility ---

export const AccessibilityCheck: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // FoundryMark has aria-label="Foundry mark"
    const mark = canvas.getByLabelText("Foundry mark");
    await expect(mark).toBeInTheDocument();
    // The wordmark text should be visible
    const wordmark = canvas.getByText("FOUNDRY");
    await expect(wordmark).toBeInTheDocument();
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
