"use client";

import { Code01, LayoutAlt04, Palette, TextInput, Trash01 } from "@untitledui/icons";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

interface DesignTokenEditorProps {
  programId: string;
}

type TabId = "colors" | "typography" | "spacing" | "code";

function safeParseJson<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function DesignTokenEditor({ programId }: DesignTokenEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>("colors");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tailwind: true,
    css: false,
    scss: false,
  });

  const tokenSets = useQuery(
    "designTokenSets:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as any[] | undefined;

  const clearAllTokens = useMutation("designTokenSets:clearAllForProgram" as any);

  async function handleClearAll() {
    if (!confirm("Clear all design tokens? This cannot be undone.")) return;
    try {
      const count = await clearAllTokens({ programId });
      toast.success(`Cleared ${count} token set(s)`);
    } catch {
      toast.error("Failed to clear tokens");
    }
  }

  if (tokenSets === undefined) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          <p className="text-sm text-text-secondary">Loading design tokens...</p>
        </div>
      </div>
    );
  }

  if (tokenSets.length === 0) {
    return (
      <div className="card border-dashed flex flex-col items-center justify-center py-12 text-center">
        <Palette size={40} className="mb-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-heading">No design tokens imported</h3>
        <p className="text-xs text-text-muted mt-1.5 max-w-xs">
          Import or upload a token set to view color swatches, typography specs, spacing scales, and
          generated code artifacts.
        </p>
      </div>
    );
  }

  const latestSet = tokenSets[tokenSets.length - 1];

  // Token categories are stored as Record<string, string|object> — convert to arrays for rendering
  const rawColors = safeParseJson(latestSet.colors, {});
  const colors: any[] = Array.isArray(rawColors)
    ? rawColors
    : Object.entries(rawColors).map(([name, value]) => ({
        name,
        hex:
          typeof value === "string"
            ? value
            : ((value as any)?.$value ?? (value as any)?.value ?? "#000"),
      }));

  const rawTypography = safeParseJson(latestSet.typography, {});
  const typography: any[] = Array.isArray(rawTypography)
    ? rawTypography
    : Object.entries(rawTypography).map(([role, value]) => ({
        role,
        ...(typeof value === "object" && value !== null ? value : {}),
      }));

  const rawSpacing = safeParseJson(latestSet.spacing, {});
  const spacing: any[] = Array.isArray(rawSpacing)
    ? rawSpacing
    : Object.entries(rawSpacing).map(([name, value]) => ({
        name,
        value: typeof value === "string" ? value : String(value),
      }));

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "colors", label: "Colors", icon: <Palette size={14} />, count: colors.length },
    {
      id: "typography",
      label: "Typography",
      icon: <TextInput size={14} />,
      count: typography.length,
    },
    { id: "spacing", label: "Spacing", icon: <LayoutAlt04 size={14} />, count: spacing.length },
    { id: "code", label: "Code Output", icon: <Code01 size={14} />, count: 3 },
  ];

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="card overflow-hidden">
      {/* Card Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-border-default">
        <div>
          <h2 className="text-sm font-semibold text-text-heading">Design Tokens</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {latestSet.name ?? "Token Set"} &mdash; {colors.length} colors, {typography.length} type
            styles, {spacing.length} spacing values
          </p>
        </div>
        <button
          onClick={handleClearAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs text-text-secondary hover:border-status-error-border hover:bg-status-error-bg hover:text-status-error-fg transition-colors"
        >
          <Trash01 size={14} />
          Clear All
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border-default px-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`
              inline-flex items-center gap-1.5 px-1 py-3 mr-5 text-xs transition-colors
              ${
                activeTab === tab.id
                  ? "border-b-2 border-accent-default font-medium text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }
            `}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`
                inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium
                ${activeTab === tab.id ? "bg-accent-subtle text-accent-default" : "bg-interactive-subtle text-text-muted"}
              `}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {/* Colors Tab */}
        {activeTab === "colors" &&
          (colors.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">
              No color tokens found in this set.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {colors.map((color: any, i: number) => {
                const hex = color.hex ?? color.value ?? "#000000";
                const name = color.name ?? color.role ?? `Color ${i + 1}`;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border-default p-3"
                  >
                    <div
                      className="h-10 w-10 shrink-0 rounded-lg border border-border-default"
                      style={{ backgroundColor: hex }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{name}</p>
                      <p className="text-[11px] text-text-muted font-mono">{hex}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {/* Typography Tab */}
        {activeTab === "typography" &&
          (typography.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">
              No typography tokens found in this set.
            </p>
          ) : (
            <div className="space-y-3">
              {typography.map((typo: any, i: number) => {
                const role = typo.role ?? typo.name ?? `Style ${i + 1}`;
                const family = typo.fontFamily ?? typo.family ?? null;
                const size = typo.fontSize ?? typo.size ?? null;
                const weight = typo.fontWeight ?? typo.weight ?? null;
                const lineHeight = typo.lineHeight ?? typo.leading ?? null;
                return (
                  <div key={i} className="rounded-lg border border-border-default p-4">
                    <p className="text-xs font-semibold text-text-heading mb-1.5">{role}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {family && (
                        <span className="text-[11px] text-text-secondary">
                          <span className="font-medium text-text-muted">Family </span>
                          <span className="font-mono">{family}</span>
                        </span>
                      )}
                      {size && (
                        <span className="text-[11px] text-text-secondary">
                          <span className="font-medium text-text-muted">Size </span>
                          <span className="font-mono">{size}</span>
                        </span>
                      )}
                      {weight && (
                        <span className="text-[11px] text-text-secondary">
                          <span className="font-medium text-text-muted">Weight </span>
                          <span className="font-mono">{weight}</span>
                        </span>
                      )}
                      {lineHeight && (
                        <span className="text-[11px] text-text-secondary">
                          <span className="font-medium text-text-muted">Line-height </span>
                          <span className="font-mono">{lineHeight}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {/* Spacing Tab */}
        {activeTab === "spacing" &&
          (spacing.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">
              No spacing tokens found in this set.
            </p>
          ) : (
            <div className="space-y-3">
              {spacing.map((item: any, i: number) => {
                const name = item.name ?? item.key ?? `space-${i}`;
                const value = item.value ?? item.size ?? "0";
                // Convert rem/px to a numeric width for the bar (max 100%)
                const numericStr = String(value).replace(/[^0-9.]/g, "");
                const numericVal = parseFloat(numericStr) || 0;
                const unit = String(value).includes("rem")
                  ? "rem"
                  : String(value).includes("em")
                    ? "em"
                    : "px";
                // Scale: 1rem = 16px → normalize to max 320px shown as percentage of 320px
                const pxEquiv = unit === "rem" || unit === "em" ? numericVal * 16 : numericVal;
                const barWidth = Math.min(Math.max((pxEquiv / 320) * 100, 1), 100);

                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-32 shrink-0">
                      <p className="text-xs font-medium text-text-primary">{name}</p>
                      <p className="text-[11px] text-text-muted font-mono">{value}</p>
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-4 rounded bg-accent-subtle"
                        style={{ width: `${barWidth}%` }}
                        aria-label={`${name}: ${value}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {/* Code Output Tab */}
        {activeTab === "code" && (
          <div className="space-y-3">
            {/* Tailwind Config */}
            <div className="rounded-lg border border-border-default overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("tailwind")}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-text-heading bg-surface-raised hover:bg-interactive-subtle transition-colors"
              >
                <span>Tailwind Config</span>
                <span className="text-text-muted">{openSections.tailwind ? "▲" : "▼"}</span>
              </button>
              {openSections.tailwind && (
                <pre className="bg-surface-elevated overflow-auto p-4 text-[11px] text-text-primary font-mono leading-relaxed max-h-80">
                  {latestSet.tailwindConfig ?? "// No Tailwind config generated yet."}
                </pre>
              )}
            </div>

            {/* CSS Variables */}
            <div className="rounded-lg border border-border-default overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("css")}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-text-heading bg-surface-raised hover:bg-interactive-subtle transition-colors"
              >
                <span>CSS Variables</span>
                <span className="text-text-muted">{openSections.css ? "▲" : "▼"}</span>
              </button>
              {openSections.css && (
                <pre className="bg-surface-elevated overflow-auto p-4 text-[11px] text-text-primary font-mono leading-relaxed max-h-80">
                  {latestSet.cssVariables ?? "/* No CSS variables generated yet. */"}
                </pre>
              )}
            </div>

            {/* SCSS Variables */}
            <div className="rounded-lg border border-border-default overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("scss")}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-text-heading bg-surface-raised hover:bg-interactive-subtle transition-colors"
              >
                <span>SCSS Variables</span>
                <span className="text-text-muted">{openSections.scss ? "▲" : "▼"}</span>
              </button>
              {openSections.scss && (
                <pre className="bg-surface-elevated overflow-auto p-4 text-[11px] text-text-primary font-mono leading-relaxed max-h-80">
                  {latestSet.scssVariables ?? "// No SCSS variables generated yet."}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
