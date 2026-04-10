import { describe, expect, test } from "vitest";
import {
  generateCssVariables,
  generateScssVariables,
  generateTailwindConfig,
  parseCssVariables,
  parseJsonTokens,
} from "../model/tokenParser";

// ── parseJsonTokens ───────────────────────────────────────────────

describe("parseJsonTokens", () => {
  test("flat format: extracts color value from colors group", () => {
    const input = JSON.stringify({ colors: { primary: "#3B82F6" } });
    const result = parseJsonTokens(input);
    expect(result.colors.primary).toBe("#3B82F6");
  });

  test("W3C Design Tokens format with $value: extracts color value", () => {
    const input = JSON.stringify({
      color: {
        gray: {
          "50": { $value: "#FFFFFF", $type: "color" },
        },
      },
    });
    const result = parseJsonTokens(input);
    expect(result.colors["gray-50"]).toBe("#FFFFFF");
  });

  test("legacy value format: extracts color value", () => {
    const input = JSON.stringify({
      colors: { primary: { value: "#3B82F6" } },
    });
    const result = parseJsonTokens(input);
    expect(result.colors.primary).toBe("#3B82F6");
  });

  test("nested groups: flattens deeply nested color tokens with dashes", () => {
    const input = JSON.stringify({
      color: {
        primitive: {
          blue: {
            "500": { $value: "#3B82F6" },
          },
        },
      },
    });
    const result = parseJsonTokens(input);
    expect(result.colors["primitive-blue-500"]).toBe("#3B82F6");
  });

  test("skips $type, $description, $schema metadata keys", () => {
    const input = JSON.stringify({
      colors: {
        $type: "color",
        $description: "Brand palette",
        $schema: "https://design-tokens.example.com",
        primary: "#3B82F6",
      },
    });
    const result = parseJsonTokens(input);
    expect(Object.keys(result.colors)).not.toContain("$type");
    expect(Object.keys(result.colors)).not.toContain("$description");
    expect(Object.keys(result.colors)).not.toContain("$schema");
    expect(result.colors.primary).toBe("#3B82F6");
  });

  test("typography extraction: captures fontFamily, fontSize, fontWeight", () => {
    const input = JSON.stringify({
      typography: {
        heading: {
          fontFamily: "Inter",
          fontSize: "32px",
          fontWeight: "600",
        },
      },
    });
    const result = parseJsonTokens(input);
    expect(result.typography.heading).toBeDefined();
    expect(result.typography.heading.fontFamily).toBe("Inter");
    expect(result.typography.heading.fontSize).toBe("32px");
    expect(result.typography.heading.fontWeight).toBe("600");
  });

  test("spacing: extracts sm and md values", () => {
    const input = JSON.stringify({
      spacing: { sm: "8px", md: "16px" },
    });
    const result = parseJsonTokens(input);
    expect(result.spacing.sm).toBe("8px");
    expect(result.spacing.md).toBe("16px");
  });

  test("empty colors group returns empty colors object", () => {
    const input = JSON.stringify({ colors: {} });
    const result = parseJsonTokens(input);
    expect(result.colors).toEqual({});
  });

  test("missing typography group returns empty typography object", () => {
    const input = JSON.stringify({ colors: { primary: "#000000" } });
    const result = parseJsonTokens(input);
    expect(result.typography).toEqual({});
  });

  test("missing spacing group returns empty spacing object", () => {
    const input = JSON.stringify({ colors: { primary: "#000000" } });
    const result = parseJsonTokens(input);
    expect(result.spacing).toEqual({});
  });

  test("invalid JSON returns empty token structure", () => {
    const result = parseJsonTokens("{ not valid json");
    expect(result.colors).toEqual({});
    expect(result.typography).toEqual({});
    expect(result.spacing).toEqual({});
  });
});

// ── parseCssVariables ─────────────────────────────────────────────

describe("parseCssVariables", () => {
  test("color variable: parsed into colors bucket", () => {
    const css = "--color-primary: #3B82F6;";
    const result = parseCssVariables(css);
    expect(result.colors["color-primary"]).toBe("#3B82F6");
  });

  test("spacing variable: parsed into spacing bucket via 'gap' keyword", () => {
    // The parser matches 'space', 'gap', 'padding', 'margin' in the variable name.
    // 'spacing' does NOT contain 'space' as a substring, but 'gap' does work.
    const css = "--gap-md: 16px;";
    const result = parseCssVariables(css);
    expect(result.spacing["gap-md"]).toBe("16px");
  });

  test("radius variable: parsed into radii bucket", () => {
    const css = "--radius-lg: 12px;";
    const result = parseCssVariables(css);
    expect(result.radii["radius-lg"]).toBe("12px");
  });

  test("shadow variable: parsed into shadows bucket", () => {
    const css = "--shadow-md: 0 4px 6px rgba(0,0,0,0.1);";
    const result = parseCssVariables(css);
    expect(result.shadows["shadow-md"]).toBe("0 4px 6px rgba(0,0,0,0.1)");
  });

  test("multiple variables: all parsed into correct buckets", () => {
    // spacing uses 'gap' because 'spacing' does not contain 'space' as a substring
    const css = [
      "--color-primary: #3B82F6;",
      "--gap-sm: 8px;",
      "--radius-sm: 4px;",
      "--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);",
    ].join("\n");
    const result = parseCssVariables(css);
    expect(result.colors["color-primary"]).toBe("#3B82F6");
    expect(result.spacing["gap-sm"]).toBe("8px");
    expect(result.radii["radius-sm"]).toBe("4px");
    expect(result.shadows["shadow-sm"]).toBe("0 1px 2px rgba(0,0,0,0.05)");
  });

  test("hex value without 'color' in name is still classified as color", () => {
    const css = "--brand: #FF0000;";
    const result = parseCssVariables(css);
    expect(result.colors.brand).toBe("#FF0000");
  });
});

// ── generateTailwindConfig ────────────────────────────────────────

describe("generateTailwindConfig", () => {
  test("returns a string containing module.exports", () => {
    const tokens = {
      colors: {},
      typography: {},
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };
    const output = generateTailwindConfig(tokens);
    expect(output).toContain("module.exports");
  });

  test("includes color entries in theme.extend when colors are present", () => {
    const tokens = {
      colors: { primary: "#3B82F6" },
      typography: {},
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };
    const output = generateTailwindConfig(tokens);
    expect(output).toContain("colors");
    expect(output).toContain('"primary"');
    expect(output).toContain("#3B82F6");
  });

  test("empty tokens produces empty extend block (no color/spacing sections)", () => {
    const tokens = {
      colors: {},
      typography: {},
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };
    const output = generateTailwindConfig(tokens);
    // Should still have the extend block but empty
    expect(output).toContain("extend");
    expect(output).not.toContain('"primary"');
  });
});

// ── generateCssVariables ──────────────────────────────────────────

describe("generateCssVariables", () => {
  test("output starts with :root {", () => {
    const tokens = {
      colors: {},
      typography: {},
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };
    const output = generateCssVariables(tokens);
    expect(output.startsWith(":root {")).toBe(true);
  });

  test("color entry is formatted as --color-<key>: <value>;", () => {
    const tokens = {
      colors: { primary: "#3B82F6" },
      typography: {},
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };
    const output = generateCssVariables(tokens);
    expect(output).toContain("--color-primary: #3B82F6;");
  });

  test("empty tokens produces only :root {} block", () => {
    const tokens = {
      colors: {},
      typography: {},
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };
    const output = generateCssVariables(tokens);
    expect(output.trim()).toBe(":root {\n}");
  });
});

// ── generateScssVariables ─────────────────────────────────────────

describe("generateScssVariables", () => {
  test("color entry is formatted as $color-<key>: <value>;", () => {
    const tokens = {
      colors: { primary: "#3B82F6" },
      typography: {},
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };
    const output = generateScssVariables(tokens);
    expect(output).toContain("$color-primary: #3B82F6;");
  });

  test("multiple categories are all included in output", () => {
    const tokens = {
      colors: { primary: "#3B82F6" },
      typography: {},
      spacing: { md: "16px" },
      breakpoints: {},
      shadows: {},
      radii: { lg: "12px" },
    };
    const output = generateScssVariables(tokens);
    expect(output).toContain("$color-primary: #3B82F6;");
    expect(output).toContain("$spacing-md: 16px;");
    expect(output).toContain("$radius-lg: 12px;");
  });

  test("empty tokens produces empty string", () => {
    const tokens = {
      colors: {},
      typography: {},
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };
    const output = generateScssVariables(tokens);
    expect(output).toBe("");
  });
});
