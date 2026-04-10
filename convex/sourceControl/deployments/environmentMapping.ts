import type { EnvironmentMapping } from "../types";

/**
 * Environment name mapping.
 *
 * Maps provider-specific environment names (e.g., "prod", "stg", "uat")
 * to normalized lifecycle stages (development, staging, qa, production).
 * Default mappings are pre-populated; users customize in program settings.
 */

// ---------------------------------------------------------------------------
// Default environment name mappings
// ---------------------------------------------------------------------------

export const DEFAULT_ENVIRONMENT_MAPPING: EnvironmentMapping = {
  development: ["dev", "development"],
  staging: ["staging", "stg", "uat"],
  qa: ["qa", "test"],
  production: ["production", "prod", "live"],
};

// ---------------------------------------------------------------------------
// mapEnvironment — normalize a raw environment name to a lifecycle stage
// ---------------------------------------------------------------------------

// TODO: Implementation (Phase 6K)
// 1. Check custom mapping from program settings first
// 2. Fall back to DEFAULT_ENVIRONMENT_MAPPING
// 3. If no match, return the raw environment name as-is
export function mapEnvironment(rawEnvironment: string, customMapping?: EnvironmentMapping): string {
  const mapping = customMapping ?? DEFAULT_ENVIRONMENT_MAPPING;
  const normalizedRaw = rawEnvironment.toLowerCase().trim();

  for (const [stage, aliases] of Object.entries(mapping)) {
    if (aliases.some((alias: string) => alias.toLowerCase() === normalizedRaw)) {
      return stage;
    }
  }

  // No match — return raw environment as-is
  return normalizedRaw;
}
