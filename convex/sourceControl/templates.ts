"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { getProvider } from "./factory";

/**
 * List template repositories available from the org's GitHub installation.
 *
 * Returns repos where is_template === true, which the user can use
 * as scaffolds when creating new repos.
 */
export const listOrgTemplateRepos = action({
  args: {
    installationId: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the calling user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const installation = await ctx.runQuery(
      internal.sourceControl.installations.getByInstallationId,
      { installationId: args.installationId },
    );
    if (!installation || installation.orgId !== args.orgId) {
      throw new Error("Installation not found or access denied");
    }

    const provider = getProvider("github");
    const tokenResult = await provider.getInstallationToken(args.installationId);

    // List repos via GitHub API directly using the installation token
    const response = await fetch("https://api.github.com/installation/repositories?per_page=100", {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${tokenResult.token}`,
        "User-Agent": "Foundry-Agent",
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const data = (await response.json()) as {
      repositories: Array<{ is_template?: boolean; [key: string]: unknown }>;
    };
    return (data.repositories ?? []).filter((r) => r.is_template === true);
  },
});
