// @ts-nocheck
"use node";

import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";

type ModelEntry = { id: string; displayName: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalAny: any = internal;

const CACHE_TTL_MS = 86_400_000; // 24 hours

/** Internal action: fetch models from Anthropic API and upsert cache. */
export const refreshModelCache = internalAction({
  args: {},
  handler: async (ctx): Promise<ModelEntry[]> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const response = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      throw new Error(`Anthropic models API returned ${response.status}: ${await response.text()}`);
    }

    const body = await response.json();
    const rawModels: Array<{ id: string; display_name?: string }> = body.data ?? [];

    const models: ModelEntry[] = rawModels
      .filter((m) => m.id.startsWith("claude-"))
      .map((m) => ({
        id: m.id,
        displayName: m.display_name ?? m.id,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const now = Date.now();
    await ctx.runMutation(internalAny.ai.modelsInternal.upsertCache, {
      provider: "anthropic",
      models,
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    });

    return models;
  },
});

/**
 * Public action: ensure cache is populated. Returns the model list.
 * Called once on mount when the query returns null.
 */
export const ensureModelCache = action({
  args: {},
  handler: async (ctx): Promise<ModelEntry[]> => {
    // Check if cache is fresh
    const cached: ModelEntry[] | null = await ctx.runQuery(
      internalAny.ai.modelsInternal.listModelsInternal,
    );
    if (cached) return cached;

    // Cache stale/missing — refresh
    const models: ModelEntry[] = await ctx.runAction(internalAny.ai.models.refreshModelCache);
    return models;
  },
});
