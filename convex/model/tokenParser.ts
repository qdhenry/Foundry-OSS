// Pure utility module — no Convex imports needed.

export interface NormalizedTokens {
  colors: Record<string, string>;
  typography: Record<
    string,
    {
      fontFamily: string;
      fontSize: string;
      fontWeight: string;
      lineHeight?: string;
    }
  >;
  spacing: Record<string, string>;
  breakpoints: Record<string, string>;
  shadows: Record<string, string>;
  radii: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Recursively flatten a nested token group into { key: value } pairs.
 * Handles both plain `{ key: "value" }` and Design Tokens format
 * `{ key: { value: "value" } }`.
 */
function flattenTokenGroup(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, val] of Object.entries(obj)) {
    // Skip W3C Design Tokens metadata keys
    if (key.startsWith("$")) continue;

    const fullKey = prefix ? `${prefix}-${key}` : key;

    if (typeof val === "string" || typeof val === "number") {
      result[fullKey] = String(val);
    } else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const record = val as Record<string, unknown>;
      // W3C Design Tokens format: { $value: "..." }
      if (typeof record.$value === "string" || typeof record.$value === "number") {
        result[fullKey] = String(record.$value);
        // Legacy Design Tokens format: { value: "..." }
      } else if (typeof record.value === "string" || typeof record.value === "number") {
        result[fullKey] = String(record.value);
      } else {
        // Nested group — recurse
        const nested = flattenTokenGroup(record, fullKey);
        Object.assign(result, nested);
      }
    }
  }

  return result;
}

/**
 * Extract typography specs from a nested object.
 * Looks for keys like fontFamily, fontSize, fontWeight, lineHeight
 * at the leaf level (either flat or Design Tokens format).
 */
function extractTypography(obj: Record<string, unknown>): NormalizedTokens["typography"] {
  const result: NormalizedTokens["typography"] = {};

  for (const [key, val] of Object.entries(obj)) {
    // Skip W3C metadata keys
    if (key.startsWith("$")) continue;

    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const record = val as Record<string, unknown>;

      // Design Tokens format: single token with a $value or value
      if (typeof record.$value === "string" || typeof record.value === "string") {
        // Skip — not a typography composite
        continue;
      }

      // Try to extract a composite typography spec
      const fontFamily = record.fontFamily ?? record["font-family"] ?? record.family;
      const fontSize = record.fontSize ?? record["font-size"] ?? record.size;
      const fontWeight = record.fontWeight ?? record["font-weight"] ?? record.weight;
      const lineHeight = record.lineHeight ?? record["line-height"] ?? record.leading;

      const extractScalar = (v: unknown): string | undefined => {
        if (typeof v === "string" || typeof v === "number") return String(v);
        if (v !== null && typeof v === "object") {
          const rec = v as Record<string, unknown>;
          // W3C: { $value: "..." }
          if (typeof rec.$value === "string" || typeof rec.$value === "number")
            return String(rec.$value);
          // Legacy: { value: "..." }
          if (typeof rec.value === "string" || typeof rec.value === "number")
            return String(rec.value);
        }
        return undefined;
      };

      const ff = extractScalar(fontFamily);
      const fs = extractScalar(fontSize);
      const fw = extractScalar(fontWeight);
      const lh = extractScalar(lineHeight);

      if (ff || fs || fw) {
        result[key] = {
          fontFamily: ff ?? "",
          fontSize: fs ?? "",
          fontWeight: fw ?? "",
          ...(lh !== undefined ? { lineHeight: lh } : {}),
        };
      } else {
        // Could be a nested group of typography tokens — recurse one level
        const nested = extractTypography(record);
        for (const [nestedKey, spec] of Object.entries(nested)) {
          result[`${key}-${nestedKey}`] = spec;
        }
      }
    }
  }

  return result;
}

// ── Alternate key aliases ─────────────────────────────────────────

const COLOR_ALIASES = ["colors", "color"] as const;
const TYPOGRAPHY_ALIASES = ["typography", "font", "fonts"] as const;
const SPACING_ALIASES = ["spacing", "space", "spaces"] as const;
const BREAKPOINT_ALIASES = ["breakpoints", "screens", "breakpoint"] as const;
const SHADOW_ALIASES = ["shadows", "shadow", "boxShadow"] as const;
const RADII_ALIASES = ["radii", "radius", "borderRadius", "rounded"] as const;

function pickGroup(
  obj: Record<string, unknown>,
  aliases: readonly string[],
): Record<string, unknown> | undefined {
  for (const alias of aliases) {
    if (alias in obj && obj[alias] !== null && typeof obj[alias] === "object") {
      return obj[alias] as Record<string, unknown>;
    }
  }
  return undefined;
}

// ── Parsers ───────────────────────────────────────────────────────

/**
 * Parse JSON design tokens (flat, nested, or Design Tokens spec format).
 */
export function parseJsonTokens(content: string): NormalizedTokens {
  const tokens: NormalizedTokens = {
    colors: {},
    typography: {},
    spacing: {},
    breakpoints: {},
    shadows: {},
    radii: {},
  };

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(content);
  } catch {
    return tokens;
  }

  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return tokens;
  }

  const colorsGroup = pickGroup(obj, COLOR_ALIASES);
  if (colorsGroup) tokens.colors = flattenTokenGroup(colorsGroup);

  const typographyGroup = pickGroup(obj, TYPOGRAPHY_ALIASES);
  if (typographyGroup) tokens.typography = extractTypography(typographyGroup);

  const spacingGroup = pickGroup(obj, SPACING_ALIASES);
  if (spacingGroup) tokens.spacing = flattenTokenGroup(spacingGroup);

  const breakpointsGroup = pickGroup(obj, BREAKPOINT_ALIASES);
  if (breakpointsGroup) tokens.breakpoints = flattenTokenGroup(breakpointsGroup);

  const shadowsGroup = pickGroup(obj, SHADOW_ALIASES);
  if (shadowsGroup) tokens.shadows = flattenTokenGroup(shadowsGroup);

  const radiiGroup = pickGroup(obj, RADII_ALIASES);
  if (radiiGroup) tokens.radii = flattenTokenGroup(radiiGroup);

  return tokens;
}

/**
 * Parse CSS custom properties into normalized tokens.
 * Classification is based on variable name heuristics.
 */
export function parseCssVariables(content: string): NormalizedTokens {
  const tokens: NormalizedTokens = {
    colors: {},
    typography: {},
    spacing: {},
    breakpoints: {},
    shadows: {},
    radii: {},
  };

  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    const name = match[1].trim();
    const value = match[2].trim();

    if (
      name.includes("color") ||
      value.startsWith("#") ||
      value.startsWith("rgb") ||
      value.startsWith("hsl")
    ) {
      tokens.colors[name] = value;
    } else if (name.includes("font") || name.includes("text")) {
      // Treat as a flat typography entry under a synthetic key
      tokens.typography[name] = {
        fontFamily: name.includes("family") ? value : "",
        fontSize: name.includes("size") || name.includes("text") ? value : "",
        fontWeight: name.includes("weight") ? value : "",
      };
    } else if (
      name.includes("space") ||
      name.includes("gap") ||
      name.includes("padding") ||
      name.includes("margin")
    ) {
      tokens.spacing[name] = value;
    } else if (name.includes("breakpoint") || name.includes("screen")) {
      tokens.breakpoints[name] = value;
    } else if (name.includes("shadow")) {
      tokens.shadows[name] = value;
    } else if (name.includes("radius") || name.includes("rounded")) {
      tokens.radii[name] = value;
    }
  }

  return tokens;
}

// ── Code generators ───────────────────────────────────────────────

/**
 * Generate a Tailwind CSS config extending the default theme.
 */
export function generateTailwindConfig(tokens: NormalizedTokens): string {
  const _indent = (str: string, n: number) =>
    str
      .split("\n")
      .map((l) => " ".repeat(n) + l)
      .join("\n");

  const toJsObject = (record: Record<string, string>, depth: number): string => {
    const lines = Object.entries(record).map(([k, v]) => `${" ".repeat(depth)}"${k}": "${v}",`);
    return lines.join("\n");
  };

  const sections: string[] = [];

  if (Object.keys(tokens.colors).length > 0) {
    sections.push(`      colors: {\n${toJsObject(tokens.colors, 8)}\n      },`);
  }
  if (Object.keys(tokens.spacing).length > 0) {
    sections.push(`      spacing: {\n${toJsObject(tokens.spacing, 8)}\n      },`);
  }
  if (Object.keys(tokens.breakpoints).length > 0) {
    sections.push(`      screens: {\n${toJsObject(tokens.breakpoints, 8)}\n      },`);
  }
  if (Object.keys(tokens.shadows).length > 0) {
    sections.push(`      boxShadow: {\n${toJsObject(tokens.shadows, 8)}\n      },`);
  }
  if (Object.keys(tokens.radii).length > 0) {
    sections.push(`      borderRadius: {\n${toJsObject(tokens.radii, 8)}\n      },`);
  }
  if (Object.keys(tokens.typography).length > 0) {
    const lines = Object.entries(tokens.typography).map(([k, v]) => {
      const parts: string[] = [];
      if (v.fontFamily) parts.push(`fontFamily: "${v.fontFamily}"`);
      if (v.fontSize) parts.push(`fontSize: "${v.fontSize}"`);
      if (v.fontWeight) parts.push(`fontWeight: "${v.fontWeight}"`);
      if (v.lineHeight) parts.push(`lineHeight: "${v.lineHeight}"`);
      return `        "${k}": { ${parts.join(", ")} },`;
    });
    sections.push(`      fontSize: {\n${lines.join("\n")}\n      },`);
  }

  return `module.exports = {
  theme: {
    extend: {
${sections.join("\n")}
    },
  },
};
`;
}

/**
 * Generate a CSS :root block of custom properties.
 */
export function generateCssVariables(tokens: NormalizedTokens): string {
  const lines: string[] = [":root {"];

  for (const [k, v] of Object.entries(tokens.colors)) {
    lines.push(`  --color-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.spacing)) {
    lines.push(`  --spacing-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.breakpoints)) {
    lines.push(`  --breakpoint-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.shadows)) {
    lines.push(`  --shadow-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.radii)) {
    lines.push(`  --radius-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.typography)) {
    if (v.fontFamily) lines.push(`  --font-family-${k}: ${v.fontFamily};`);
    if (v.fontSize) lines.push(`  --font-size-${k}: ${v.fontSize};`);
    if (v.fontWeight) lines.push(`  --font-weight-${k}: ${v.fontWeight};`);
    if (v.lineHeight) lines.push(`  --line-height-${k}: ${v.lineHeight};`);
  }

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/**
 * Generate SCSS variable declarations.
 */
export function generateScssVariables(tokens: NormalizedTokens): string {
  const lines: string[] = [];

  for (const [k, v] of Object.entries(tokens.colors)) {
    lines.push(`$color-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.spacing)) {
    lines.push(`$spacing-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.breakpoints)) {
    lines.push(`$breakpoint-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.shadows)) {
    lines.push(`$shadow-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.radii)) {
    lines.push(`$radius-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.typography)) {
    if (v.fontFamily) lines.push(`$font-family-${k}: ${v.fontFamily};`);
    if (v.fontSize) lines.push(`$font-size-${k}: ${v.fontSize};`);
    if (v.fontWeight) lines.push(`$font-weight-${k}: ${v.fontWeight};`);
    if (v.lineHeight) lines.push(`$line-height-${k}: ${v.lineHeight};`);
  }

  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}
