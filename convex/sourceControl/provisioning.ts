"use node";

import { v } from "convex/values";
import * as generatedApi from "../_generated/api";
import { action } from "../_generated/server";
import { getProvider } from "./factory";
import type { GitHubProvider } from "./providers/github";
import { fetchTemplateFiles } from "./templates/fetcher";
import { deriveVariables, renderTemplateFiles } from "./templates/renderer";

const internalApi: any = (generatedApi as any).internal;
const apiAny: any = (generatedApi as any).api;

/**
 * Provision a new repository from a template.
 *
 * Orchestration flow:
 *   1. Validate org access via installation
 *   2. Get installation token
 *   3. Fetch template files from the template repo
 *   4. Derive computed variables (prefixLower, prefixKebab)
 *   5. Render templates with Handlebars
 *   6. Create new repo with rendered content
 *   7. Connect repo to program via connectRepository mutation
 *   8. Return repo URL and metadata
 */
export const provisionFromTemplate = action({
  args: {
    programId: v.id("programs"),
    installationId: v.string(),
    owner: v.string(),
    repoName: v.string(),
    isPrivate: v.boolean(),
    templateRepoFullName: v.string(),
    variables: v.object({
      projectPrefix: v.string(),
      clientName: v.string(),
      orgAlias: v.string(),
      scratchOrgAlias: v.string(),
      erpSystem: v.optional(v.string()),
      cpqSystem: v.optional(v.string()),
      taxSystem: v.optional(v.string()),
      paymentGateway: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // 1. Validate org access
    const installation = await ctx.runQuery(
      internalApi.sourceControl.installations.getByInstallationId,
      { installationId: args.installationId },
    );
    if (!installation || installation.status !== "active") {
      throw new Error("Installation not found or not active");
    }

    // Verify program belongs to same org
    const program = await ctx.runQuery(internalApi.programs.getByIdInternal, {
      programId: args.programId,
    });
    if (!program) {
      throw new Error("Program not found");
    }
    if (program.orgId !== installation.orgId) {
      throw new Error("Program and installation belong to different organizations");
    }

    // 2. Get installation token
    const provider = getProvider("github") as GitHubProvider;
    const tokenResult = await provider.getInstallationToken(args.installationId);
    provider.setToken(tokenResult.token);

    // 3. Fetch template files
    const templateFiles = await fetchTemplateFiles(provider, args.templateRepoFullName);

    if (templateFiles.length === 0) {
      throw new Error(`No template files found in ${args.templateRepoFullName}`);
    }

    // 4. Derive computed variables
    const variables = deriveVariables({
      ...args.variables,
      repoName: args.repoName,
    });

    // 5. Render templates
    const renderedFiles = renderTemplateFiles(templateFiles, variables);

    // 6. Create new repo with rendered content
    const repoResult = await provider.createRepoWithContent(
      args.owner,
      args.repoName,
      `${args.variables.clientName} - Salesforce B2B Commerce`,
      renderedFiles.map((f) => ({
        path: f.path,
        content: f.content,
      })),
      args.isPrivate,
    );

    // 7. Connect repo to program
    await ctx.runMutation(apiAny.sourceControl.repositories.connectRepository, {
      programId: args.programId,
      installationId: args.installationId,
      repoFullName: repoResult.repoFullName,
      providerRepoId: String(repoResult.repoId),
      defaultBranch: repoResult.defaultBranch,
      role: "storefront" as const,
      isMonorepo: false,
    });

    // 8. Return result
    return {
      repoUrl: repoResult.htmlUrl,
      repoFullName: repoResult.repoFullName,
      defaultBranch: repoResult.defaultBranch,
      filesProvisioned: renderedFiles.length,
    };
  },
});
