// Pure utility module — no Convex imports needed.

export type TaskType = "ui-heavy" | "mixed" | "backend" | "infrastructure";

export interface DesignContextData {
  resolvedTokens: string;
  resolvedComponents: string;
  screenSpecs: string | null;
  interactionSpecs: string;
}

// ── Keyword sets ──────────────────────────────────────────────────

const UI_KEYWORDS = [
  "component",
  "page",
  "layout",
  "screen",
  "ui",
  "ux",
  "design",
  "style",
  "css",
  "tailwind",
  "frontend",
  "front-end",
  "responsive",
  "modal",
  "form",
  "button",
  "card",
  "dashboard",
  "sidebar",
  "header",
  "navigation",
  "menu",
  "tooltip",
  "animation",
  "theme",
  "dark mode",
];

const BACKEND_KEYWORDS = [
  "api",
  "endpoint",
  "database",
  "migration",
  "schema",
  "query",
  "mutation",
  "action",
  "webhook",
  "cron",
  "job",
  "worker",
  "auth",
  "security",
  "encryption",
  "middleware",
];

const INFRA_KEYWORDS = [
  "deploy",
  "ci",
  "cd",
  "docker",
  "cloudflare",
  "vercel",
  "environment",
  "config",
  "monitoring",
  "logging",
];

// ── Classification ────────────────────────────────────────────────

/**
 * Classify a task as ui-heavy, mixed, backend, or infrastructure
 * based on keyword frequency in the title and description.
 */
export function classifyTaskType(taskTitle: string, taskDescription?: string): TaskType {
  const combined = `${taskTitle} ${taskDescription ?? ""}`.toLowerCase();

  let uiCount = 0;
  let backendCount = 0;
  let infraCount = 0;

  for (const kw of UI_KEYWORDS) {
    if (combined.includes(kw)) uiCount++;
  }
  for (const kw of BACKEND_KEYWORDS) {
    if (combined.includes(kw)) backendCount++;
  }
  for (const kw of INFRA_KEYWORDS) {
    if (combined.includes(kw)) infraCount++;
  }

  if (infraCount > uiCount && infraCount > backendCount) return "infrastructure";
  if (backendCount > uiCount) return "backend";
  if (uiCount >= 2) return "ui-heavy";
  if (uiCount > 0) return "mixed";
  return "mixed";
}

// ── Token extraction helpers ──────────────────────────────────────

/**
 * Extract only the colors section from a serialized JSON tokens string.
 * Returns a JSON string containing just the colors, or the original
 * string if parsing fails (graceful degradation).
 */
function extractBrandColors(resolvedTokens: string): string {
  try {
    const obj = JSON.parse(resolvedTokens) as Record<string, unknown>;
    const colorsKey = ["colors", "color"].find(
      (k) => k in obj && obj[k] !== null && typeof obj[k] === "object",
    );
    if (colorsKey) {
      return JSON.stringify({ [colorsKey]: obj[colorsKey] }, null, 2);
    }
    // No colors key found — return empty object
    return "{}";
  } catch {
    // Not valid JSON — return as-is (may be CSS variables or plain text)
    return resolvedTokens;
  }
}

// ── Component inventory parser ────────────────────────────────────

/**
 * Count items in the resolvedComponents string.
 * Handles both JSON array format and newline-delimited text.
 */
function countComponents(resolvedComponents: string): number {
  const trimmed = resolvedComponents.trim();
  if (!trimmed) return 0;

  // Try JSON array first
  try {
    const arr = JSON.parse(trimmed);
    if (Array.isArray(arr)) return arr.length;
  } catch {
    // Fall through
  }

  // Newline-delimited lines
  return trimmed.split("\n").filter((l) => l.trim().length > 0).length;
}

/**
 * Format the component inventory as a bullet list.
 * Handles both JSON array format and pre-formatted strings.
 */
function formatComponents(resolvedComponents: string): string {
  const trimmed = resolvedComponents.trim();
  if (!trimmed) return "";

  // Try JSON array format
  try {
    const arr = JSON.parse(trimmed) as Array<{
      name?: string;
      type?: string;
      description?: string;
      codeMatch?: { filePath?: string; componentName?: string };
    }>;
    if (Array.isArray(arr)) {
      return arr
        .map((c) => {
          const name = c.name ?? "Unknown";
          const type = c.type ?? "component";
          const desc = c.description ?? "";
          const codePart = c.codeMatch?.filePath ? ` [code: ${c.codeMatch.filePath}]` : "";
          return `- ${name} (${type}): ${desc}${codePart}`;
        })
        .join("\n");
    }
  } catch {
    // Fall through — treat as pre-formatted text
  }

  // Already formatted text — return as-is
  return trimmed;
}

/**
 * Count items in the interactionSpecs string.
 * Handles both JSON array format and newline-delimited text.
 */
function countInteractions(interactionSpecs: string): number {
  const trimmed = interactionSpecs.trim();
  if (!trimmed) return 0;

  try {
    const arr = JSON.parse(trimmed);
    if (Array.isArray(arr)) return arr.length;
  } catch {
    // Fall through
  }

  return trimmed.split("\n").filter((l) => l.trim().length > 0).length;
}

/**
 * Format interaction specs as a bullet list.
 * Handles both JSON array format and pre-formatted strings.
 */
function formatInteractions(interactionSpecs: string): string {
  const trimmed = interactionSpecs.trim();
  if (!trimmed) return "";

  try {
    const arr = JSON.parse(trimmed) as Array<{
      componentName?: string;
      trigger?: string;
      animationType?: string;
      duration?: string;
      description?: string;
    }>;
    if (Array.isArray(arr)) {
      return arr
        .map((i) => {
          const name = i.componentName ?? "unknown";
          const trigger = i.trigger ?? "unknown";
          const animType = i.animationType ?? "unknown";
          const duration = i.duration ? ` (${i.duration})` : "";
          const desc = i.description ? ` — ${i.description}` : "";
          return `- ${name}: ${trigger} → ${animType}${duration}${desc}`;
        })
        .join("\n");
    }
  } catch {
    // Fall through
  }

  return trimmed;
}

// ── Main assembler ────────────────────────────────────────────────

/**
 * Assemble a design context XML block for inclusion in the AI prompt.
 * Returns null for infrastructure tasks or when there is nothing to include.
 */
export function assembleDesignContext(data: DesignContextData, taskType: TaskType): string | null {
  if (taskType === "infrastructure") return null;

  const inner: string[] = [];

  if (taskType === "backend") {
    // Backend: only brand colors
    const brandColors = extractBrandColors(data.resolvedTokens);
    if (brandColors && brandColors !== "{}") {
      inner.push(
        `  <design_tokens format="json" scope="brand-colors-only">\n${brandColors}\n  </design_tokens>`,
      );
    }
  } else {
    // mixed or ui-heavy: tokens + component inventory
    const tokens = data.resolvedTokens.trim();
    if (tokens && tokens !== "{}") {
      inner.push(`  <design_tokens format="json">\n${tokens}\n  </design_tokens>`);
    }

    const componentCount = countComponents(data.resolvedComponents);
    if (componentCount > 0) {
      const componentList = formatComponents(data.resolvedComponents);
      inner.push(
        `  <component_inventory count="${componentCount}">\n${componentList}\n  </component_inventory>`,
      );
    }

    if (taskType === "ui-heavy") {
      // screen spec
      if (data.screenSpecs?.trim()) {
        inner.push(`  <screen_spec>\n${data.screenSpecs.trim()}\n  </screen_spec>`);
      }

      // interaction specs
      const interactionCount = countInteractions(data.interactionSpecs);
      if (interactionCount > 0) {
        const interactionList = formatInteractions(data.interactionSpecs);
        inner.push(
          `  <interaction_specs count="${interactionCount}">\n${interactionList}\n  </interaction_specs>`,
        );
      }
    }
  }

  if (inner.length === 0) return null;

  return `<design_context task_type="${taskType}">\n${inner.join("\n")}\n</design_context>`;
}
