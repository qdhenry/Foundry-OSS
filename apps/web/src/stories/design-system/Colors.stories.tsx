import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// --- Color Swatch Component ---
function ColorSwatch({
  name,
  value,
  description,
}: {
  name: string;
  value: string;
  description?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: value,
          border: "1px solid var(--border-default, #1a2038)",
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>
          {name}
        </div>
        <div style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
          {value}
        </div>
        {description && (
          <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

function ColorGroup({
  title,
  colors,
}: {
  title: string;
  colors: { name: string; value: string; description?: string }[];
}) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h3
        style={{
          fontSize: "0.88rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {colors.map((c) => (
          <ColorSwatch key={c.name} {...c} />
        ))}
      </div>
    </div>
  );
}

// --- Brand Blue Scale ---
const brandBlue = [
  { name: "brandBlue.50", value: "#eff6ff", description: "Lightest blue tint" },
  { name: "brandBlue.100", value: "#dbeafe", description: "Light blue tint" },
  { name: "brandBlue.200", value: "#bfdbfe", description: "Ice — primary gate node" },
  { name: "brandBlue.300", value: "#93c5fd", description: "Sky — secondary nodes, gradient start" },
  { name: "brandBlue.400", value: "#60a5fa", description: "Electric — crossbar, mid-accent" },
  { name: "brandBlue.500", value: "#3b82f6", description: "Deep — terminus, gradient end" },
  { name: "brandBlue.600", value: "#2563eb", description: "Vivid — light-mode primary" },
  { name: "brandBlue.700", value: "#1d4ed8", description: "Depth — light-mode secondary" },
  { name: "brandBlue.800", value: "#1e40af", description: "Anchor — light-mode deep" },
  { name: "brandBlue.900", value: "#1e3a8a", description: "Ink — light-mode darkest" },
];

const semantic = [
  { name: "success", value: "#4ade80", description: "Success green (dark)" },
  { name: "successDeep", value: "#16a34a", description: "Success green (light)" },
  { name: "warning", value: "#fbbf24", description: "Warning amber (dark)" },
  { name: "warningDeep", value: "#d97706", description: "Warning amber (light)" },
  { name: "error", value: "#f87171", description: "Error red (dark)" },
  { name: "errorDeep", value: "#dc2626", description: "Error red (light)" },
  { name: "info", value: "#60a5fa", description: "Info blue (dark)" },
  { name: "infoDeep", value: "#2563eb", description: "Info blue (light)" },
];

const darkSurfaces = [
  { name: "surface.page", value: "#050509", description: "Page background — surface-0" },
  {
    name: "surface.default",
    value: "#0a0e1a",
    description: "Midnight — cards, sections — surface-1",
  },
  {
    name: "surface.raised",
    value: "#0f1424",
    description: "Raised — modals, dropdowns — surface-2",
  },
  {
    name: "surface.elevated",
    value: "#151d35",
    description: "Elevated — active states — surface-3",
  },
  { name: "surface.overlay", value: "rgba(5, 5, 9, 0.85)", description: "Nav/overlay backdrop" },
];

const lightSurfaces = [
  { name: "surface.page", value: "#f8fafc", description: "Page background — surface-0" },
  { name: "surface.default", value: "#ffffff", description: "Cards — surface-1" },
  { name: "surface.raised", value: "#f1f5f9", description: "Modals, raised — surface-2" },
  { name: "surface.elevated", value: "#e2e8f0", description: "Active states — surface-3" },
  {
    name: "surface.overlay",
    value: "rgba(248, 250, 252, 0.88)",
    description: "Nav/overlay backdrop",
  },
];

const darkText = [
  { name: "text.primary", value: "#c8d4e8", description: "Headings, body text" },
  { name: "text.secondary", value: "#6878a0", description: "Descriptions, sub-text" },
  { name: "text.muted", value: "#3a4868", description: "Captions, labels, disabled" },
  { name: "text.heading", value: "#d0daf0", description: "Display serif headings" },
  { name: "text.wordmark", value: "#93afd0", description: "FOUNDRY wordmark" },
  { name: "text.onBrand", value: "#ffffff", description: "Text on brand backgrounds" },
];

const lightText = [
  { name: "text.primary", value: "#0f172a", description: "Headings, body text" },
  { name: "text.secondary", value: "#475569", description: "Descriptions, sub-text" },
  { name: "text.muted", value: "#94a3b8", description: "Captions, labels, disabled" },
  { name: "text.heading", value: "#0f172a", description: "Display serif headings" },
  { name: "text.wordmark", value: "#1e293b", description: "FOUNDRY wordmark" },
  { name: "text.onBrand", value: "#ffffff", description: "Text on brand backgrounds" },
];

const darkBorders = [
  { name: "border.default", value: "#1a2038", description: "Default border" },
  { name: "border.subtle", value: "#111830", description: "Subtle dividers" },
  { name: "border.accent", value: "rgba(59, 130, 246, 0.15)", description: "Accent/brand border" },
];

const lightBorders = [
  { name: "border.default", value: "#e2e8f0", description: "Default border" },
  { name: "border.subtle", value: "#f1f5f9", description: "Subtle dividers" },
  { name: "border.accent", value: "rgba(37, 99, 235, 0.15)", description: "Accent/brand border" },
  { name: "border.strong", value: "#cbd5e1", description: "Emphasized border" },
];

const interactive = [
  { name: "interactive.ghost", value: "rgba(59, 130, 246, 0.04)", description: "Focus rings" },
  {
    name: "interactive.subtle",
    value: "rgba(59, 130, 246, 0.06)",
    description: "Badge/icon backgrounds",
  },
  {
    name: "interactive.hover",
    value: "rgba(59, 130, 246, 0.10)",
    description: "Button/card hover",
  },
  {
    name: "interactive.active",
    value: "rgba(59, 130, 246, 0.15)",
    description: "Active/selected state",
  },
  {
    name: "interactive.glow",
    value: "rgba(59, 130, 246, 0.08)",
    description: "Ambient glow effects",
  },
];

// --- Storybook Meta ---

function ColorsPage() {
  return <div />;
}

const meta = {
  title: "Design System/Colors",
  component: ColorsPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ColorsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrandBlueScale: Story = {
  render: () => (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>
          Brand Blue Scale
        </h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          The primary brand palette. 10-stop blue scale used for the Foundry mark, accents, and
          interactive states.
        </p>
      </div>
      <div
        style={{ display: "flex", borderRadius: 12, overflow: "hidden", marginBottom: "1.5rem" }}
      >
        {brandBlue.map((c) => (
          <div
            key={c.name}
            style={{ flex: 1, height: 64, background: c.value }}
            title={`${c.name}: ${c.value}`}
          />
        ))}
      </div>
      <ColorGroup title="" colors={brandBlue} />
    </div>
  ),
};

export const SemanticColors: Story = {
  render: () => <ColorGroup title="Semantic Colors" colors={semantic} />,
};

export const DarkThemeSurfaces: Story = {
  render: () => (
    <div>
      <ColorGroup title="Dark — Surfaces" colors={darkSurfaces} />
      <ColorGroup title="Dark — Text" colors={darkText} />
      <ColorGroup title="Dark — Borders" colors={darkBorders} />
    </div>
  ),
};

export const LightThemeSurfaces: Story = {
  render: () => (
    <div>
      <ColorGroup title="Light — Surfaces" colors={lightSurfaces} />
      <ColorGroup title="Light — Text" colors={lightText} />
      <ColorGroup title="Light — Borders" colors={lightBorders} />
    </div>
  ),
};

export const InteractiveStates: Story = {
  render: () => <ColorGroup title="Interactive States (Dark Theme)" colors={interactive} />,
};

export const StatusColors: Story = {
  render: () => {
    const statuses = [
      {
        label: "Success",
        fg: "#4ade80",
        bg: "rgba(74, 222, 128, 0.08)",
        border: "rgba(74, 222, 128, 0.15)",
      },
      {
        label: "Warning",
        fg: "#fbbf24",
        bg: "rgba(251, 191, 36, 0.08)",
        border: "rgba(251, 191, 36, 0.15)",
      },
      {
        label: "Error",
        fg: "#f87171",
        bg: "rgba(248, 113, 113, 0.08)",
        border: "rgba(248, 113, 113, 0.15)",
      },
      {
        label: "Info",
        fg: "#60a5fa",
        bg: "rgba(96, 165, 250, 0.08)",
        border: "rgba(96, 165, 250, 0.15)",
      },
    ];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
        {statuses.map((s) => (
          <div
            key={s.label}
            style={{
              padding: "1rem",
              borderRadius: 10,
              background: s.bg,
              border: `1px solid ${s.border}`,
              color: s.fg,
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            {s.label}
          </div>
        ))}
      </div>
    );
  },
};
