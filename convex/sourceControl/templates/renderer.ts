// @ts-nocheck
"use node";

import Handlebars from "handlebars";

// ---------------------------------------------------------------------------
// Template variable types
// ---------------------------------------------------------------------------

export interface TemplateVariables {
  projectPrefix: string;
  projectPrefixLower: string;
  projectPrefixKebab: string;
  clientName: string;
  repoName: string;
  orgAlias: string;
  scratchOrgAlias: string;
  erpSystem?: string;
  cpqSystem?: string;
  taxSystem?: string;
  paymentGateway?: string;
  buyerAccountCount?: string;
  skuCount?: string;
  monthlyOrderVolume?: string;
}

// ---------------------------------------------------------------------------
// Register custom Handlebars helpers
// ---------------------------------------------------------------------------

function registerHelpers(): void {
  // Equality check: {{#if (eq erpSystem "Rootstock")}}
  Handlebars.registerHelper("eq", (a: unknown, b: unknown): boolean => a === b);

  // Not-equal: {{#if (neq erpSystem "None")}}
  Handlebars.registerHelper("neq", (a: unknown, b: unknown): boolean => a !== b);

  // Or helper: {{#if (or (eq a "X") (eq b "Y"))}}
  Handlebars.registerHelper("or", (...args: unknown[]): boolean => {
    // Last arg is the Handlebars options hash
    const values = args.slice(0, -1);
    return values.some(Boolean);
  });

  // And helper: {{#if (and (eq a "X") (eq b "Y"))}}
  Handlebars.registerHelper("and", (...args: unknown[]): boolean => {
    const values = args.slice(0, -1);
    return values.every(Boolean);
  });
}

// ---------------------------------------------------------------------------
// Derive computed variables from user-provided inputs
// ---------------------------------------------------------------------------

export function deriveVariables(
  input: Omit<TemplateVariables, "projectPrefixLower" | "projectPrefixKebab"> & {
    projectPrefixLower?: string;
    projectPrefixKebab?: string;
  },
): TemplateVariables {
  const projectPrefixLower = input.projectPrefixLower ?? input.projectPrefix.toLowerCase();

  // PascalCase → kebab-case: "AcmeCo" → "acme-co"
  const projectPrefixKebab =
    input.projectPrefixKebab ??
    input.projectPrefix
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();

  return {
    ...input,
    projectPrefixLower,
    projectPrefixKebab,
  };
}

// ---------------------------------------------------------------------------
// Render template files
// ---------------------------------------------------------------------------

export function renderTemplateFiles(
  files: Array<{ path: string; content: string }>,
  variables: TemplateVariables,
): Array<{ path: string; content: string }> {
  registerHelpers();

  return files.map((file) => {
    try {
      const template = Handlebars.compile(file.content, {
        noEscape: true, // Don't HTML-escape output (these aren't HTML templates)
        strict: false, // Don't throw on missing variables
      });
      return {
        path: file.path,
        content: template(variables),
      };
    } catch (err) {
      // If a file fails to compile (e.g., binary-ish content or syntax issues),
      // return it unchanged
      console.warn(`Template rendering skipped for ${file.path}:`, err);
      return file;
    }
  });
}
