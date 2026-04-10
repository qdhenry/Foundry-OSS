"use client";

import { useAction } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EngagementType = "greenfield" | "migration" | "integration" | "ongoing_product_dev";

export type TechStackCategory =
  | "frontend"
  | "backend"
  | "database"
  | "cloud"
  | "commerce_platform"
  | "cms";

export interface TechStackEntry {
  category: TechStackCategory;
  technologies: string[];
}

export interface WorkstreamEntry {
  name: string;
  shortCode: string;
  sortOrder: number;
  description?: string;
}

export interface ProgramBasicsData {
  name: string;
  clientName: string;
  engagementType: EngagementType | "";
  techStack: TechStackEntry[];
  description: string;
  startDate: string;
  targetEndDate: string;
  workstreams: WorkstreamEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENGAGEMENT_TYPES: {
  value: EngagementType;
  label: string;
  description: string;
}[] = [
  {
    value: "greenfield",
    label: "Greenfield Build",
    description: "New application from the ground up",
  },
  {
    value: "migration",
    label: "Platform Migration",
    description: "Move between platforms or systems",
  },
  {
    value: "integration",
    label: "System Integration",
    description: "Connect existing systems and data",
  },
  {
    value: "ongoing_product_dev",
    label: "Ongoing Product Dev",
    description: "Continuous development on a live product",
  },
];

const TECH_STACK_CATEGORIES: {
  category: TechStackCategory;
  label: string;
  options: string[];
}[] = [
  {
    category: "frontend",
    label: "Frontend",
    options: ["React", "Next.js", "Vue", "Angular", "Svelte", "Other"],
  },
  {
    category: "backend",
    label: "Backend",
    options: ["Node.js", "Python", "Java", "Go", ".NET", "Ruby", "Other"],
  },
  {
    category: "database",
    label: "Database",
    options: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB", "Other"],
  },
  {
    category: "cloud",
    label: "Cloud",
    options: ["AWS", "GCP", "Azure", "Cloudflare", "Vercel", "Other"],
  },
  {
    category: "commerce_platform",
    label: "Commerce",
    options: ["Shopify", "Salesforce Commerce", "BigCommerce", "Magento", "WooCommerce", "Other"],
  },
  {
    category: "cms",
    label: "CMS",
    options: ["WordPress", "Contentful", "Sanity", "Strapi", "Drupal", "Other"],
  },
];

const DEFAULT_WORKSTREAMS: WorkstreamEntry[] = [
  { name: "Discovery & Planning", shortCode: "DISC", sortOrder: 0 },
  { name: "Core Development", shortCode: "DEV", sortOrder: 1 },
  { name: "Testing & QA", shortCode: "QA", sortOrder: 2 },
  { name: "Deployment & Launch", shortCode: "DEPLOY", sortOrder: 3 },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProgramBasicsFormProps {
  data: ProgramBasicsData;
  onChange: (data: ProgramBasicsData) => void;
  onNext: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgramBasicsForm({ data, onChange, onNext }: ProgramBasicsFormProps) {
  const [errors, setErrors] = useState<{
    name?: string;
    clientName?: string;
    engagementType?: string;
  }>({});
  const [techStackExpanded, setTechStackExpanded] = useState(false);
  const [otherInputs, setOtherInputs] = useState<Record<TechStackCategory, string>>({
    frontend: "",
    backend: "",
    database: "",
    cloud: "",
    commerce_platform: "",
    cms: "",
  });

  // Workstream generation state
  const [showWorkstreams, setShowWorkstreams] = useState(false);
  const [generatingWorkstreams, setGeneratingWorkstreams] = useState(false);
  const [workstreamError, setWorkstreamError] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());

  const suggestWorkstreams = useAction(api.programs.suggestWorkstreams);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const update = useCallback(
    (field: keyof ProgramBasicsData, value: unknown) => {
      onChange({ ...data, [field]: value });
      if (field in errors) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [data, onChange, errors],
  );

  const validate = useCallback(() => {
    const newErrors: typeof errors = {};
    if (!data.name.trim()) newErrors.name = "Program name is required";
    if (!data.clientName.trim()) newErrors.clientName = "Client name is required";
    if (!data.engagementType) newErrors.engagementType = "Engagement type is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data]);

  // ---------------------------------------------------------------------------
  // Tech stack helpers
  // ---------------------------------------------------------------------------

  const getTechsForCategory = useCallback(
    (category: TechStackCategory): string[] => {
      const entry = data.techStack.find((e) => e.category === category);
      return entry?.technologies ?? [];
    },
    [data.techStack],
  );

  const toggleTech = useCallback(
    (category: TechStackCategory, tech: string) => {
      const current = getTechsForCategory(category);
      const updated = current.includes(tech)
        ? current.filter((t) => t !== tech)
        : [...current, tech];

      const newStack = data.techStack.filter((e) => e.category !== category);
      if (updated.length > 0) {
        newStack.push({ category, technologies: updated });
      }
      update("techStack", newStack);
    },
    [data.techStack, getTechsForCategory, update],
  );

  const addOtherTech = useCallback(
    (category: TechStackCategory) => {
      const value = otherInputs[category].trim();
      if (!value) return;
      const current = getTechsForCategory(category);
      if (!current.includes(value)) {
        const newStack = data.techStack.filter((e) => e.category !== category);
        newStack.push({ category, technologies: [...current, value] });
        update("techStack", newStack);
      }
      setOtherInputs((prev) => ({ ...prev, [category]: "" }));
    },
    [data.techStack, getTechsForCategory, otherInputs, update],
  );

  // ---------------------------------------------------------------------------
  // Workstream helpers
  // ---------------------------------------------------------------------------

  const generateShortCode = (name: string): string => {
    return name
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 5);
  };

  const handleGenerateWorkstreams = useCallback(async () => {
    setGeneratingWorkstreams(true);
    setWorkstreamError(null);
    try {
      if (suggestWorkstreams) {
        const result = await suggestWorkstreams({
          engagementType: data.engagementType as EngagementType,
          description: data.description.trim() || undefined,
          techStack: data.techStack.length > 0 ? data.techStack : undefined,
        });
        if (Array.isArray(result) && result.length > 0) {
          update(
            "workstreams",
            result.map(
              (ws: { name: string; shortCode?: string; description?: string }, i: number) => ({
                name: ws.name,
                shortCode: ws.shortCode || generateShortCode(ws.name),
                sortOrder: i,
                description: ws.description,
              }),
            ),
          );
          setShowWorkstreams(true);
          return;
        }
      }
      // Fallback
      throw new Error("No results");
    } catch {
      setWorkstreamError("Could not generate workstreams. Using defaults instead.");
      update(
        "workstreams",
        DEFAULT_WORKSTREAMS.map((ws, i) => ({ ...ws, sortOrder: i })),
      );
      setShowWorkstreams(true);
    } finally {
      setGeneratingWorkstreams(false);
    }
  }, [data, suggestWorkstreams, update]);

  const handleNext = useCallback(async () => {
    if (!validate()) return;

    if (!showWorkstreams) {
      await handleGenerateWorkstreams();
      return;
    }

    onNext();
  }, [validate, showWorkstreams, handleGenerateWorkstreams, onNext]);

  const updateWorkstream = useCallback(
    (index: number, field: keyof WorkstreamEntry, value: string) => {
      const updated = [...data.workstreams];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "name") {
        updated[index].shortCode = generateShortCode(value);
      }
      update("workstreams", updated);
    },
    [data.workstreams, update],
  );

  const removeWorkstream = useCallback(
    (index: number) => {
      if (data.workstreams.length <= 1) return;
      const updated = data.workstreams
        .filter((_, i) => i !== index)
        .map((ws, i) => ({ ...ws, sortOrder: i }));
      update("workstreams", updated);
    },
    [data.workstreams, update],
  );

  const addWorkstream = useCallback(() => {
    const updated = [
      ...data.workstreams,
      {
        name: "",
        shortCode: "",
        sortOrder: data.workstreams.length,
      },
    ];
    update("workstreams", updated);
  }, [data.workstreams, update]);

  const moveWorkstream = useCallback(
    (index: number, direction: "up" | "down") => {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= data.workstreams.length) return;
      const updated = [...data.workstreams];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      update(
        "workstreams",
        updated.map((ws, i) => ({ ...ws, sortOrder: i })),
      );
    },
    [data.workstreams, update],
  );

  const toggleDescription = useCallback((index: number) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const inputClass = (hasError: boolean) => `input ${hasError ? "border-red-500" : ""}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <h2 className="mb-1 text-lg font-semibold text-text-heading">Program Setup</h2>
      <p className="mb-6 text-sm text-text-secondary">
        Define your engagement and configure your program.
      </p>

      <div className="space-y-5">
        {/* Engagement Type Cards */}
        <div>
          <label className="form-label">
            Engagement Type <span className="text-red-500">*</span>
          </label>
          {errors.engagementType && (
            <p className="mb-2 text-xs text-red-500">{errors.engagementType}</p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ENGAGEMENT_TYPES.map((et) => {
              const selected = data.engagementType === et.value;
              return (
                <button
                  key={et.value}
                  type="button"
                  onClick={() => update("engagementType", et.value)}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${
                    selected
                      ? "border-accent-default bg-status-info-bg"
                      : "border-border-default bg-surface-raised hover:border-text-muted"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      selected ? "text-accent-default" : "text-text-heading"
                    }`}
                  >
                    {et.label}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">{et.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Program Name */}
        <div>
          <label htmlFor="wizard-name" className="form-label">
            Program Name <span className="text-red-500">*</span>
          </label>
          <input
            id="wizard-name"
            type="text"
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g., Acme Corp Platform Build"
            className={inputClass(!!errors.name)}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* Client Name */}
        <div>
          <label htmlFor="wizard-client" className="form-label">
            Client Name <span className="text-red-500">*</span>
          </label>
          <input
            id="wizard-client"
            type="text"
            value={data.clientName}
            onChange={(e) => update("clientName", e.target.value)}
            placeholder="e.g., Acme Corp"
            className={inputClass(!!errors.clientName)}
          />
          {errors.clientName && <p className="mt-1 text-xs text-red-500">{errors.clientName}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="wizard-desc" className="form-label">
            Description
          </label>
          <textarea
            id="wizard-desc"
            value={data.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            placeholder="Brief description of the program..."
            className="textarea"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="wizard-start" className="form-label">
              Start Date
            </label>
            <input
              id="wizard-start"
              type="date"
              value={data.startDate}
              onChange={(e) => update("startDate", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="wizard-end" className="form-label">
              Target End Date
            </label>
            <input
              id="wizard-end"
              type="date"
              value={data.targetEndDate}
              onChange={(e) => update("targetEndDate", e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Tech Stack Selector (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setTechStackExpanded(!techStackExpanded)}
            className="flex w-full items-center justify-between rounded-lg border border-border-default bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-interactive-hover"
          >
            <div>
              <span className="text-sm font-medium text-text-heading">Tech Stack</span>
              <span className="ml-2 text-xs text-text-secondary">(optional)</span>
            </div>
            <svg
              className={`h-4 w-4 text-text-muted transition-transform ${techStackExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {techStackExpanded && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {TECH_STACK_CATEGORIES.map((cat) => {
                const selectedTechs = getTechsForCategory(cat.category);
                return (
                  <div
                    key={cat.category}
                    className="rounded-lg border border-border-default bg-surface-raised p-3"
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      {cat.label}
                    </p>
                    <div className="space-y-1.5">
                      {cat.options
                        .filter((opt) => opt !== "Other")
                        .map((opt) => (
                          <label
                            key={opt}
                            className="flex cursor-pointer items-center gap-2 text-sm text-text-primary"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTechs.includes(opt)}
                              onChange={() => toggleTech(cat.category, opt)}
                              className="h-3.5 w-3.5 rounded border-border-default text-accent-default accent-accent-default"
                            />
                            {opt}
                          </label>
                        ))}
                      {/* Other free-text input */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={otherInputs[cat.category]}
                          onChange={(e) =>
                            setOtherInputs((prev) => ({
                              ...prev,
                              [cat.category]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addOtherTech(cat.category);
                            }
                          }}
                          placeholder="Other..."
                          className="input h-7 flex-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => addOtherTech(cat.category)}
                          disabled={!otherInputs[cat.category].trim()}
                          className="h-7 shrink-0 rounded-md bg-accent-default px-2 text-xs font-medium text-text-on-brand hover:bg-accent-strong disabled:opacity-40"
                        >
                          Add
                        </button>
                      </div>
                      {/* Custom tech tags */}
                      {selectedTechs
                        .filter((t) => !cat.options.filter((o) => o !== "Other").includes(t))
                        .map((custom) => (
                          <span
                            key={custom}
                            className="mr-1 inline-flex items-center gap-1 rounded-full bg-status-info-bg px-2 py-0.5 text-xs font-medium text-accent-default"
                          >
                            {custom}
                            <button
                              type="button"
                              onClick={() => toggleTech(cat.category, custom)}
                              className="ml-0.5 text-accent-default hover:text-text-heading"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workstream Editor (shown after generation) */}
        {showWorkstreams && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="form-label mb-0">Workstreams</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateWorkstreams}
                  disabled={generatingWorkstreams}
                  className="rounded-md border border-border-default px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-interactive-hover disabled:opacity-50"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={addWorkstream}
                  className="rounded-md border border-border-default px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-interactive-hover"
                >
                  + Add Workstream
                </button>
              </div>
            </div>

            {workstreamError && (
              <div className="mb-3 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2">
                <p className="text-xs text-status-warning-fg">{workstreamError}</p>
              </div>
            )}

            <div className="space-y-2">
              {data.workstreams.map((ws, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border-default bg-surface-raised p-3"
                >
                  <div className="flex items-center gap-2">
                    {/* Reorder buttons */}
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveWorkstream(index, "up")}
                        disabled={index === 0}
                        className="rounded p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWorkstream(index, "down")}
                        disabled={index === data.workstreams.length - 1}
                        className="rounded p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Name input */}
                    <input
                      type="text"
                      value={ws.name}
                      onChange={(e) => updateWorkstream(index, "name", e.target.value)}
                      placeholder="Workstream name"
                      className="input h-8 flex-1 text-sm"
                    />

                    {/* Short code badge */}
                    <span className="shrink-0 rounded bg-surface-elevated px-2 py-0.5 text-xs font-mono text-text-secondary">
                      {ws.shortCode || "—"}
                    </span>

                    {/* Expand description */}
                    <button
                      type="button"
                      onClick={() => toggleDescription(index)}
                      className="shrink-0 rounded p-1 text-text-muted hover:text-text-primary"
                      title="Toggle description"
                    >
                      <svg
                        className={`h-4 w-4 transition-transform ${expandedDescriptions.has(index) ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeWorkstream(index)}
                      disabled={data.workstreams.length <= 1}
                      className="shrink-0 rounded p-1 text-text-muted hover:text-red-500 disabled:opacity-30"
                      aria-label="Remove workstream"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Description (expandable) */}
                  {expandedDescriptions.has(index) && (
                    <textarea
                      value={ws.description ?? ""}
                      onChange={(e) => updateWorkstream(index, "description", e.target.value)}
                      placeholder="Optional description..."
                      rows={2}
                      className="textarea mt-2 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="mt-6 flex justify-end">
        {generatingWorkstreams ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Generating suggested workstreams...
          </div>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-accent-strong"
          >
            {showWorkstreams ? "Continue" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}
