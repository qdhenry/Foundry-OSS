import type { Meta, StoryObj } from "@storybook/nextjs-vite";

function SpacingPage() {
  return <div />;
}

const meta = {
  title: "Design System/Spacing & Layout",
  component: SpacingPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof SpacingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Spacing Scale ---

export const SpacingScale: Story = {
  render: () => {
    const spacings = [
      { token: "1", px: 4 },
      { token: "2", px: 8 },
      { token: "3", px: 12 },
      { token: "4", px: 16 },
      { token: "5", px: 20 },
      { token: "6", px: 24 },
      { token: "8", px: 32 },
      { token: "10", px: 40 },
      { token: "12", px: 48 },
      { token: "16", px: 64 },
      { token: "20", px: 80 },
      { token: "24", px: 96 },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h3
          style={{
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "0.5rem",
          }}
        >
          Spacing Scale
        </h3>
        {spacings.map((s) => (
          <div key={s.token} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 60,
                textAlign: "right",
                fontSize: "0.72rem",
                fontFamily: "monospace",
                color: "var(--text-muted)",
              }}
            >
              sp-{s.token}
            </div>
            <div
              style={{
                width: s.px,
                height: 20,
                borderRadius: 4,
                background: "var(--accent-default, #60a5fa)",
                opacity: 0.7,
              }}
            />
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              {s.px}px ({s.px / 16}rem)
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Border Radius ---

export const BorderRadius: Story = {
  render: () => {
    const radii = [
      { token: "sm", px: 6, usage: "Buttons, inputs" },
      { token: "md", px: 10, usage: "Code blocks, icon containers" },
      { token: "lg", px: 14, usage: "Cards, swatches" },
      { token: "xl", px: 16, usage: "Component cards, modals" },
      { token: "2xl", px: 20, usage: "Large feature cards" },
      { token: "full", px: 9999, usage: "Badges, pills, avatars" },
    ];
    return (
      <div>
        <h3
          style={{
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "1rem",
          }}
        >
          Border Radius
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
          {radii.map((r) => (
            <div key={r.token} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: r.px,
                  border: "2px solid var(--accent-default, #60a5fa)",
                  background: "var(--interactive-subtle, rgba(59, 130, 246, 0.06))",
                  margin: "0 auto 0.5rem",
                }}
              />
              <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-primary)" }}>
                {r.token}
              </div>
              <div
                style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "var(--text-muted)" }}
              >
                {r.px}px
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: 2 }}>
                {r.usage}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

// --- Shadows ---

export const Shadows: Story = {
  render: () => {
    const shadows = [
      { token: "sm", value: "0 1px 2px rgba(0, 0, 0, 0.3)", description: "Small shadow" },
      { token: "md", value: "0 4px 12px rgba(0, 0, 0, 0.25)", description: "Medium shadow" },
      { token: "lg", value: "0 8px 30px rgba(0, 0, 0, 0.3)", description: "Large shadow" },
      {
        token: "glow",
        value: "0 0 40px rgba(59, 130, 246, 0.08)",
        description: "Blue ambient glow",
      },
      {
        token: "buttonHover",
        value: "0 4px 20px rgba(59, 130, 246, 0.25)",
        description: "Primary button hover",
      },
      {
        token: "focusRing",
        value: "0 0 0 3px rgba(59, 130, 246, 0.04)",
        description: "Input focus ring",
      },
    ];
    return (
      <div>
        <h3
          style={{
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "1rem",
          }}
        >
          Shadows
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
          {shadows.map((s) => (
            <div key={s.token} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 14,
                  background: "var(--surface-default, #0a0e1a)",
                  border: "1px solid var(--border-default, #1a2038)",
                  boxShadow: s.value,
                  margin: "0 auto 0.5rem",
                }}
              />
              <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-primary)" }}>
                {s.token}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                {s.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

// --- Opacity ---

export const Opacity: Story = {
  render: () => {
    const opacities = [
      { token: "ghost", value: "4%", usage: "Focus rings" },
      { token: "subtle", value: "6%", usage: "Badge/icon backgrounds" },
      { token: "hover", value: "10%", usage: "Button hover states" },
      { token: "active", value: "15%", usage: "Active/selected states" },
      { token: "noise-dark", value: "2%", usage: "Film grain overlay (dark)" },
      { token: "noise-light", value: "1.2%", usage: "Film grain overlay (light)" },
    ];
    return (
      <div>
        <h3
          style={{
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "1rem",
          }}
        >
          Opacity Tokens
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {opacities.map((o) => (
            <div key={o.token} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: 70,
                  textAlign: "right",
                  fontSize: "0.72rem",
                  fontFamily: "monospace",
                  color: "var(--text-muted)",
                }}
              >
                {o.token}
              </div>
              <div
                style={{
                  width: 60,
                  height: 32,
                  borderRadius: 6,
                  background: `rgba(59, 130, 246, ${parseFloat(o.value) / 100})`,
                  border: "1px solid var(--border-default, #1a2038)",
                }}
              />
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                {o.value} — {o.usage}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

// --- Sizing ---

export const Sizing: Story = {
  render: () => {
    const sizes = [
      { token: "icon-sm", px: 16 },
      { token: "icon-default", px: 20, note: "Default icon, 1.5px stroke" },
      { token: "icon-lg", px: 24 },
      { token: "badge-dot", px: 6, note: "Badge indicator dot" },
      { token: "gutter", px: 32, note: "Page padding (2rem)" },
    ];
    const maxWidths = [
      { token: "maxWidth-narrow", px: 800, usage: "Blog, forms, focused reading" },
      { token: "maxWidth-default", px: 1200, usage: "Standard content sections" },
      { token: "maxWidth-wide", px: 1400, usage: "Dashboards, data-dense layouts" },
    ];
    return (
      <div>
        <h3
          style={{
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "1rem",
          }}
        >
          Icon & Element Sizing
        </h3>
        <div style={{ display: "flex", alignItems: "end", gap: "1.5rem", marginBottom: "2rem" }}>
          {sizes.map((s) => (
            <div key={s.token} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: s.px,
                  height: s.px,
                  borderRadius: s.token === "badge-dot" ? "50%" : 4,
                  background: "var(--accent-default, #60a5fa)",
                  margin: "0 auto 0.5rem",
                }}
              />
              <div
                style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "var(--text-muted)" }}
              >
                {s.token}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>{s.px}px</div>
            </div>
          ))}
        </div>

        <h3
          style={{
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "1rem",
          }}
        >
          Max Widths
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {maxWidths.map((m) => (
            <div key={m.token}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.25rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontFamily: "monospace",
                    color: "var(--text-muted)",
                  }}
                >
                  {m.token}
                </span>
                <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                  {m.px}px — {m.usage}
                </span>
              </div>
              <div
                style={{
                  width: `min(${m.px}px, 100%)`,
                  height: 8,
                  borderRadius: 4,
                  background: "var(--accent-default, #60a5fa)",
                  opacity: 0.5,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  },
};
