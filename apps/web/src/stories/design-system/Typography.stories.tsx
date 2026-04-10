import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

function TypographyPage() {
  return <div />;
}

const meta = {
  title: "Design System/Typography",
  component: TypographyPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof TypographyPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Font Families ---

export const FontFamilies: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {[
        {
          name: "Instrument Serif",
          usage: "Headlines, hero, editorial",
          weight: "400 only",
          sample: "The quick brown fox jumps",
        },
        {
          name: "DM Sans",
          usage: "UI, body, labels, wordmark",
          weight: "300–700",
          sample: "The quick brown fox jumps over the lazy dog",
        },
        {
          name: "DM Mono",
          usage: "Code, data, hex values",
          weight: "300–500",
          sample: "const foundry = { version: '1.0' }",
        },
      ].map((f) => (
        <div key={f.name}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.75rem",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {f.name}
            </span>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{f.usage}</span>
            <span
              style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "var(--text-muted)" }}
            >
              w{f.weight}
            </span>
          </div>
          <div
            style={{
              fontFamily: `'${f.name}', sans-serif`,
              fontSize: "1.5rem",
              color: "var(--text-primary)",
              lineHeight: 1.4,
            }}
          >
            {f.sample}
          </div>
        </div>
      ))}
    </div>
  ),
};

// --- Type Scale ---

export const TypeScale: Story = {
  render: () => {
    const sizes = [
      {
        token: "displayXL",
        rem: "4",
        px: "64px",
        family: "Instrument Serif",
        weight: 400,
        sample: "Hero Headline",
      },
      {
        token: "displayL",
        rem: "2.8",
        px: "44.8px",
        family: "Instrument Serif",
        weight: 400,
        sample: "Section Heading",
      },
      {
        token: "displayM",
        rem: "1.55",
        px: "24.8px",
        family: "Instrument Serif",
        weight: 400,
        sample: "Card / Feature Title",
      },
      {
        token: "bodyL",
        rem: "1.1",
        px: "17.6px",
        family: "DM Sans",
        weight: 300,
        sample: "Hero subheadline, section descriptions",
      },
      {
        token: "bodyM",
        rem: "0.88",
        px: "14.1px",
        family: "DM Sans",
        weight: 300,
        sample: "Standard body text for reading and UI content",
      },
      {
        token: "bodyS",
        rem: "0.82",
        px: "13.1px",
        family: "DM Sans",
        weight: 400,
        sample: "Small body, list items, compact UI",
      },
      {
        token: "button",
        rem: "0.85",
        px: "13.6px",
        family: "DM Sans",
        weight: 500,
        sample: "BUTTON TEXT",
      },
      {
        token: "caption",
        rem: "0.72",
        px: "11.5px",
        family: "DM Sans",
        weight: 500,
        sample: "CAPTION / LABEL OVERLINE",
      },
      {
        token: "code",
        rem: "0.72",
        px: "11.5px",
        family: "DM Mono",
        weight: 400,
        sample: "const value = getData();",
      },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {sizes.map((s) => (
          <div key={s.token} style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
            <div style={{ width: 100, flexShrink: 0, textAlign: "right" }}>
              <div
                style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)" }}
              >
                {s.token}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{s.px}</div>
            </div>
            <div
              style={{
                fontFamily: `'${s.family}', sans-serif`,
                fontSize: `${s.rem}rem`,
                fontWeight: s.weight,
                color: "var(--text-primary)",
                lineHeight: 1.3,
                letterSpacing:
                  s.token === "caption" ? "0.12em" : s.token === "button" ? "0.02em" : undefined,
                textTransform: s.token === "caption" ? "uppercase" : undefined,
              }}
            >
              {s.sample}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Font Weights ---

export const FontWeights: Story = {
  render: () => {
    const weights = [
      { token: "light", value: 300 },
      { token: "regular", value: 400 },
      { token: "medium", value: 500 },
      { token: "semibold", value: 600 },
      { token: "bold", value: 700 },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {weights.map((w) => (
          <div key={w.token} style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
            <div
              style={{
                width: 80,
                fontSize: "0.72rem",
                fontFamily: "monospace",
                color: "var(--text-muted)",
                textAlign: "right",
              }}
            >
              {w.value}
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: w.value,
                fontSize: "1.25rem",
                color: "var(--text-primary)",
              }}
            >
              {w.token} — The quick brown fox
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Letter Spacing ---

export const LetterSpacing: Story = {
  render: () => {
    const spacings = [
      { token: "tight", value: "0.02em", usage: "Buttons" },
      { token: "normal", value: "0.04em", usage: "Badges, nav links" },
      { token: "wide", value: "0.08em", usage: "Wordmark lockup" },
      { token: "wider", value: "0.1em", usage: "Section numbers, card labels" },
      { token: "widest", value: "0.12em", usage: "Caption/label overlines" },
      { token: "ultra", value: "0.14em", usage: "Section numbers" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {spacings.map((s) => (
          <div key={s.token} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: 80, textAlign: "right" }}>
              <div
                style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)" }}
              >
                {s.token}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{s.value}</div>
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                fontSize: "0.82rem",
                letterSpacing: s.value,
                textTransform: "uppercase",
                color: "var(--text-primary)",
              }}
            >
              FOUNDRY PLATFORM
            </div>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{s.usage}</span>
          </div>
        ))}
      </div>
    );
  },
};

// --- Line Heights ---

export const LineHeights: Story = {
  render: () => {
    const heights = [
      { token: "tight", value: "105%", usage: "Display XL headlines", fontSize: "2rem" },
      { token: "display", value: "115%", usage: "Display L headings", fontSize: "1.5rem" },
      { token: "heading", value: "120%", usage: "Display M, card titles", fontSize: "1.25rem" },
      { token: "body", value: "165%", usage: "Standard body text", fontSize: "0.88rem" },
      { token: "relaxed", value: "170%", usage: "Body L, descriptions", fontSize: "0.88rem" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {heights.map((h) => (
          <div key={h.token} style={{ display: "flex", gap: "1rem" }}>
            <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
              <div
                style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)" }}
              >
                {h.token}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{h.value}</div>
            </div>
            <div
              style={{
                fontSize: h.fontSize,
                lineHeight: h.value,
                color: "var(--text-primary)",
                fontFamily: "'DM Sans', sans-serif",
                maxWidth: 500,
                padding: "0.5rem",
                background: "var(--interactive-ghost, rgba(59, 130, 246, 0.04))",
                borderRadius: 6,
              }}
            >
              The quick brown fox jumps over the lazy dog. This sample demonstrates the {h.token}{" "}
              line height used for {h.usage.toLowerCase()}.
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Composed Text Styles ---

export const TextStyles: Story = {
  name: "Text Styles (Composites)",
  render: () => {
    const styles = [
      {
        token: "displayXL",
        description: "Hero headlines",
        css: {
          fontFamily: "'Instrument Serif', serif",
          fontWeight: 400,
          fontSize: "4rem",
          lineHeight: "105%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample: "Hero Headline",
      },
      {
        token: "displayL",
        description: "Section headings",
        css: {
          fontFamily: "'Instrument Serif', serif",
          fontWeight: 400,
          fontSize: "2.8rem",
          lineHeight: "115%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample: "Section Heading",
      },
      {
        token: "displayM",
        description: "Card/feature titles",
        css: {
          fontFamily: "'Instrument Serif', serif",
          fontWeight: 400,
          fontSize: "1.55rem",
          lineHeight: "120%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample: "Card Title or Feature Name",
      },
      {
        token: "bodyL",
        description: "Hero subheadline, section descriptions",
        css: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 300,
          fontSize: "1.1rem",
          lineHeight: "170%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample:
          "A longer paragraph of text that demonstrates the body large style used for hero subheadlines and section descriptions throughout the interface.",
      },
      {
        token: "bodyM",
        description: "Standard body text",
        css: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 300,
          fontSize: "0.88rem",
          lineHeight: "165%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample:
          "Standard body text used for the majority of readable content in the application. This style balances readability with information density.",
      },
      {
        token: "bodyS",
        description: "Small body, list items",
        css: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 400,
          fontSize: "0.82rem",
          lineHeight: "150%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample: "Small body text for list items, compact UI elements, and secondary content areas.",
      },
      {
        token: "captionLabel",
        description: "Caption/label overlines",
        css: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          fontSize: "0.72rem",
          lineHeight: "140%",
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
        } as React.CSSProperties,
        sample: "Caption Label Overline",
      },
      {
        token: "wordmark",
        description: "FOUNDRY wordmark lockup",
        css: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          fontSize: "1.4rem",
          lineHeight: "100%",
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
        } as React.CSSProperties,
        sample: "FOUNDRY",
      },
      {
        token: "button",
        description: "Default button text",
        css: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          fontSize: "0.85rem",
          lineHeight: "140%",
          letterSpacing: "0.02em",
        } as React.CSSProperties,
        sample: "Button Label",
      },
      {
        token: "input",
        description: "Input field text",
        css: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 400,
          fontSize: "0.85rem",
          lineHeight: "140%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample: "Placeholder or input value text",
      },
      {
        token: "label",
        description: "Form labels",
        css: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          fontSize: "0.75rem",
          lineHeight: "140%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample: "Field Label",
      },
      {
        token: "code",
        description: "Code blocks",
        css: {
          fontFamily: "'DM Mono', monospace",
          fontWeight: 400,
          fontSize: "0.72rem",
          lineHeight: "170%",
          letterSpacing: "0",
        } as React.CSSProperties,
        sample: "const pipeline = await foundry.createPipeline({ name: 'audit' });",
      },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {styles.map((s, i) => (
          <div
            key={s.token}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr",
              gap: "1.5rem",
              padding: "1.25rem 0",
              borderTop: i === 0 ? "none" : "1px solid var(--border-subtle, #111830)",
              alignItems: "baseline",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  fontFamily: "monospace",
                  color: "var(--accent-label, #60a5fa)",
                }}
              >
                {s.token}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 2 }}>
                {s.description}
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  color: "var(--text-muted)",
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                {s.css.fontFamily?.toString().split(",")[0].replace(/'/g, "")}
                <br />w{s.css.fontWeight} / {s.css.fontSize}
                <br />
                lh {s.css.lineHeight}
                {s.css.letterSpacing && s.css.letterSpacing !== "0" ? (
                  <>
                    <br />
                    ls {s.css.letterSpacing}
                  </>
                ) : null}
              </div>
            </div>
            <div
              style={{
                ...s.css,
                color: "var(--text-primary)",
                maxWidth: s.token.startsWith("display") ? undefined : 600,
              }}
            >
              {s.sample}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Font Specimen ---

export const FontSpecimen: Story = {
  name: "Font Specimen",
  render: () => {
    const families = [
      {
        name: "Instrument Serif",
        fallback: "serif",
        weights: [{ value: 400, label: "Regular" }],
        sample: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        description: "Display font for headlines. Elegant serif with high contrast strokes.",
      },
      {
        name: "DM Sans",
        fallback: "sans-serif",
        weights: [
          { value: 300, label: "Light" },
          { value: 400, label: "Regular" },
          { value: 500, label: "Medium" },
          { value: 600, label: "Semibold" },
          { value: 700, label: "Bold" },
        ],
        sample: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        description:
          "Primary UI font. Clean geometric sans with excellent legibility at small sizes.",
      },
      {
        name: "DM Mono",
        fallback: "monospace",
        weights: [
          { value: 300, label: "Light" },
          { value: 400, label: "Regular" },
          { value: 500, label: "Medium" },
        ],
        sample: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(){}[]",
        description: "Monospace for code, data values, and hex colors. Matches DM Sans metrics.",
      },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        {families.map((f) => (
          <div key={f.name}>
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  {f.name}
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    fontFamily: "monospace",
                  }}
                >
                  {f.weights.length} weight{f.weights.length > 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 2 }}>
                {f.description}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {f.weights.map((w) => (
                <div key={w.value} style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
                  <div style={{ width: 90, flexShrink: 0, textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontFamily: "monospace",
                        color: "var(--text-muted)",
                      }}
                    >
                      {w.value} {w.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: `'${f.name}', ${f.fallback}`,
                      fontWeight: w.value,
                      fontSize: "1.1rem",
                      color: "var(--text-primary)",
                      letterSpacing: "0.01em",
                      lineHeight: 1.5,
                      overflowWrap: "break-word",
                    }}
                  >
                    {f.sample}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- In-Context Usage ---

export const InContext: Story = {
  name: "In-Context Usage",
  render: () => (
    <div style={{ maxWidth: 640 }}>
      {/* Hero section */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            fontSize: "0.72rem",
            lineHeight: "140%",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--accent-label, #60a5fa)",
            marginBottom: "0.5rem",
          }}
        >
          01 — Program Overview
        </div>
        <div
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontWeight: 400,
            fontSize: "2.8rem",
            lineHeight: "115%",
            color: "var(--text-heading, #d0daf0)",
            marginBottom: "0.75rem",
          }}
        >
          AcmeCorp Audit
        </div>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "1.1rem",
            lineHeight: "170%",
            color: "var(--text-secondary)",
          }}
        >
          A comprehensive compliance audit program tracking 47 requirements across 6 workstreams
          with automated evidence collection and gate-based progression.
        </div>
      </div>

      {/* Card section */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: 14,
          background: "var(--surface-default, #0a0e1a)",
          border: "1px solid var(--border-default, #1a2038)",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontWeight: 400,
            fontSize: "1.55rem",
            lineHeight: "120%",
            color: "var(--text-primary)",
            marginBottom: "0.5rem",
          }}
        >
          Sprint Velocity
        </div>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "0.88rem",
            lineHeight: "165%",
            color: "var(--text-secondary)",
            marginBottom: "0.75rem",
          }}
        >
          Current sprint is tracking 12 tasks across 3 workstreams with 8 completed so far.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              fontSize: "0.85rem",
              lineHeight: "140%",
              letterSpacing: "0.02em",
              padding: "0.5rem 1rem",
              borderRadius: 6,
              background: "var(--accent-strong, #3b82f6)",
              color: "#fff",
            }}
          >
            View Sprint
          </div>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              fontSize: "0.75rem",
              lineHeight: "140%",
              color: "var(--text-muted)",
            }}
          >
            3 days remaining
          </div>
        </div>
      </div>

      {/* Code block */}
      <div
        style={{
          padding: "1rem",
          borderRadius: 10,
          background: "#0a0e1a",
          border: "1px solid #1a2038",
        }}
      >
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontWeight: 400,
            fontSize: "0.72rem",
            lineHeight: "170%",
            color: "#6878a0",
          }}
        >
          <span style={{ color: "#3a4868" }}>14:32:01</span>{" "}
          <span style={{ color: "#60a5fa" }}>agent.audit</span> Evidence collected for REQ-047{"\n"}
          <span style={{ color: "#3a4868" }}>14:32:03</span>{" "}
          <span style={{ color: "#4ade80" }}>gate.pass</span>{" "}
          <span style={{ color: "#93c5fd" }}>Gate 3 approved — all criteria met</span>
        </div>
      </div>
    </div>
  ),
};

// --- Responsive ---

export const Mobile: Story = {
  render: () => (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--text-primary)" }}>
      <div
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: "2rem",
          lineHeight: "105%",
          marginBottom: "0.5rem",
        }}
      >
        Mobile Headline
      </div>
      <div style={{ fontSize: "0.88rem", lineHeight: "165%", color: "var(--text-secondary)" }}>
        Body text at standard size renders comfortably on mobile viewports.
      </div>
    </div>
  ),
  parameters: { viewport: { defaultViewport: "mobile" } },
};
