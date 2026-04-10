// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { getProvider } from "./factory";

/**
 * List repositories accessible by a GitHub App installation.
 *
 * Called from the settings page when the user clicks "Connect Repository".
 */
export const listAvailableRepos = action({
  args: {
    installationId: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Verify installation belongs to this org
    const installation = await ctx.runQuery(
      internal.sourceControl.installations.getByInstallationId,
      { installationId: args.installationId },
    );
    if (!installation || installation.orgId !== args.orgId) {
      throw new Error("Installation not found or access denied");
    }

    // 2. Get installation token
    const provider = getProvider("github");
    const tokenResult = await provider.getInstallationToken(args.installationId);
    provider.setToken(tokenResult.token);

    // 3. List repos from GitHub API
    const repos = await provider.listInstallationRepos();

    return repos;
  },
});
