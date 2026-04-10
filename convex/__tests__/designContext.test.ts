import { describe, expect, test } from "vitest";
import type { DesignContextData } from "../model/designContext";
import { assembleDesignContext, classifyTaskType } from "../model/designContext";

// ── classifyTaskType ──────────────────────────────────────────────

describe("classifyTaskType", () => {
  test('"Build login page component" → ui-heavy (hits "page" + "component")', () => {
    expect(classifyTaskType("Build login page component")).toBe("ui-heavy");
  });

  test('"Add API endpoint for user data" → backend', () => {
    expect(classifyTaskType("Add API endpoint for user data")).toBe("backend");
  });

  test('"Deploy to Cloudflare Workers" → infrastructure', () => {
    expect(classifyTaskType("Deploy to Cloudflare Workers")).toBe("infrastructure");
  });

  test('"Add search feature with UI and API" → mixed (ui=1, backend>=1)', () => {
    // "ui" hits uiCount=1, "api" hits backendCount=1
    // backendCount is not > uiCount (they're equal), uiCount is not >=2, uiCount > 0 → "mixed"
    expect(classifyTaskType("Add search feature with UI and API")).toBe("mixed");
  });

  test('"Create dashboard layout with sidebar" → ui-heavy (multiple UI keywords)', () => {
    // "dashboard" + "layout" + "sidebar" → uiCount >= 2
    expect(classifyTaskType("Create dashboard layout with sidebar")).toBe("ui-heavy");
  });

  test("empty string → mixed (default)", () => {
    expect(classifyTaskType("")).toBe("mixed");
  });

  test("single UI keyword → mixed (uiCount=1 but not >=2)", () => {
    expect(classifyTaskType("Update the button")).toBe("mixed");
  });

  test("infra dominates when only infra keywords", () => {
    expect(classifyTaskType("Set up CI CD pipeline")).toBe("infrastructure");
  });

  test("backend dominates over single UI keyword", () => {
    // backendCount > uiCount when uiCount=1 and backendCount=2
    expect(classifyTaskType("Set up auth middleware endpoint")).toBe("backend");
  });
});

// ── assembleDesignContext ─────────────────────────────────────────

/** Minimal data with real tokens so backend path produces something */
const WITH_COLORS_DATA: DesignContextData = {
  resolvedTokens: JSON.stringify({ colors: { primary: "#3B82F6" } }),
  resolvedComponents: "",
  screenSpecs: null,
  interactionSpecs: "",
};

/** Full data for ui-heavy path */
const FULL_DATA: DesignContextData = {
  resolvedTokens: JSON.stringify({ colors: { primary: "#3B82F6" } }),
  resolvedComponents: JSON.stringify([
    { name: "Button", type: "button", description: "Primary action" },
    { name: "Card", type: "card", description: "Content card" },
  ]),
  screenSpecs: "Login screen: full-width form with centered layout",
  interactionSpecs: JSON.stringify([
    {
      componentName: "Button",
      trigger: "hover",
      animationType: "scale",
      duration: "200ms",
    },
  ]),
};

/** Mixed data: has tokens + components but no screen/interaction specs */
const MIXED_DATA: DesignContextData = {
  resolvedTokens: JSON.stringify({ colors: { primary: "#3B82F6" } }),
  resolvedComponents: JSON.stringify([
    { name: "Button", type: "button", description: "Primary action" },
  ]),
  screenSpecs: null,
  interactionSpecs: "",
};

/** Truly empty data */
const EMPTY_DATA: DesignContextData = {
  resolvedTokens: "{}",
  resolvedComponents: "",
  screenSpecs: null,
  interactionSpecs: "",
};

describe("assembleDesignContext", () => {
  test("infrastructure task → returns null", () => {
    expect(assembleDesignContext(WITH_COLORS_DATA, "infrastructure")).toBeNull();
  });

  test("backend task with brand colors → includes <design_tokens> with brand-colors-only scope", () => {
    const result = assembleDesignContext(WITH_COLORS_DATA, "backend");
    expect(result).not.toBeNull();
    expect(result).toContain("<design_tokens");
    expect(result).toContain('scope="brand-colors-only"');
  });

  test("backend task → does NOT include <component_inventory>", () => {
    const result = assembleDesignContext(FULL_DATA, "backend");
    expect(result).not.toContain("<component_inventory");
  });

  test("mixed task → includes tokens and component inventory", () => {
    const result = assembleDesignContext(MIXED_DATA, "mixed");
    expect(result).not.toBeNull();
    expect(result).toContain("<design_tokens");
    expect(result).toContain("<component_inventory");
  });

  test("mixed task → does NOT include <screen_spec> or <interaction_specs>", () => {
    const result = assembleDesignContext(MIXED_DATA, "mixed");
    expect(result).not.toContain("<screen_spec>");
    expect(result).not.toContain("<interaction_specs");
  });

  test("ui-heavy task → includes all 4 sections", () => {
    const result = assembleDesignContext(FULL_DATA, "ui-heavy");
    expect(result).not.toBeNull();
    expect(result).toContain("<design_tokens");
    expect(result).toContain("<component_inventory");
    expect(result).toContain("<screen_spec>");
    expect(result).toContain("<interaction_specs");
  });

  test("empty data (no tokens, no components) → returns null", () => {
    expect(assembleDesignContext(EMPTY_DATA, "ui-heavy")).toBeNull();
    expect(assembleDesignContext(EMPTY_DATA, "mixed")).toBeNull();
    expect(assembleDesignContext(EMPTY_DATA, "backend")).toBeNull();
  });

  test('outer XML wrapper uses <design_context task_type="..."> for ui-heavy', () => {
    const result = assembleDesignContext(FULL_DATA, "ui-heavy");
    expect(result).toMatch(/^<design_context task_type="ui-heavy">/);
    expect(result).toMatch(/<\/design_context>$/);
  });

  test('outer XML wrapper uses <design_context task_type="..."> for mixed', () => {
    const result = assembleDesignContext(MIXED_DATA, "mixed");
    expect(result).toMatch(/^<design_context task_type="mixed">/);
  });

  test('outer XML wrapper uses <design_context task_type="..."> for backend', () => {
    const result = assembleDesignContext(WITH_COLORS_DATA, "backend");
    expect(result).toMatch(/^<design_context task_type="backend">/);
  });

  test("ui-heavy with no screen spec or interactions still returns tokens + components", () => {
    const partialData: DesignContextData = {
      resolvedTokens: JSON.stringify({ colors: { primary: "#3B82F6" } }),
      resolvedComponents: JSON.stringify([
        { name: "Button", type: "button", description: "Primary action" },
      ]),
      screenSpecs: null,
      interactionSpecs: "",
    };
    const result = assembleDesignContext(partialData, "ui-heavy");
    expect(result).not.toBeNull();
    expect(result).toContain("<design_tokens");
    expect(result).toContain("<component_inventory");
    expect(result).not.toContain("<screen_spec>");
    expect(result).not.toContain("<interaction_specs");
  });

  test("backend task with no colors in tokens → returns null", () => {
    const noColorsData: DesignContextData = {
      resolvedTokens: JSON.stringify({ spacing: { sm: "8px" } }),
      resolvedComponents: "",
      screenSpecs: null,
      interactionSpecs: "",
    };
    // extractBrandColors will return "{}" when no colors key present
    expect(assembleDesignContext(noColorsData, "backend")).toBeNull();
  });
});
