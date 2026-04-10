"use node";

import { ConvexError } from "convex/values";
import { GitHubProvider } from "./providers/github";
import type { ProviderType, SourceControlProvider } from "./types";

/**
 * Returns a SourceControlProvider instance for the given provider type.
 *
 * All platform code should call this factory instead of importing providers
 * directly. When a new provider is added, register it here.
 */
export function getProvider(providerType: ProviderType): SourceControlProvider {
  switch (providerType) {
    case "github":
      return new GitHubProvider();
    default:
      throw new ConvexError(
        `Source control provider "${providerType}" is not implemented. V1 supports GitHub only.`,
      );
  }
}
