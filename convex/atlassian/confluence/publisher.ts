"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "../../_generated/api";
import { action, internalAction } from "../../_generated/server";
import { renderGapAnalysis, renderProgramOverview } from "./renderer";

const internalApi: any = (generatedApi as any).internal;

const PAGE_TYPES = ["program_overview", "gap_analysis"] as const;
type PageType = (typeof PAGE_TYPES)[number];

async function resolveAccessToken(
  ctx: {
    runQuery: (...args: any[]) => any;
    runAction: (...args: any[]) => any;
    runMutation: (...args: any[]) => any;
  },
  programId: any,
): Promise<{ accessToken: string; cloudId: string; connection: any }> {
  const atlassianInternal = internalApi.atlassian;

  const connection = await ctx.runQuery(atlassianInternal.connections.getByProgramInternal, {
    programId,
  });
  if (!connection) throw new ConvexError("Atlassian connection not found");
  if (connection.status !== "connected") throw new ConvexError("Atlassian is not connected");
  if (!connection.accessTokenEncrypted) throw new ConvexError("No access token stored");
  if (!connection.atlassianSiteId) throw new ConvexError("No Atlassian site ID configured");

  let accessToken: string = await ctx.runAction(atlassianInternal.oauthActions.decryptToken, {
    encryptedToken: connection.accessTokenEncrypted,
  });

  // Refresh if token expires within 5 minutes
  const TOKEN_BUFFER_MS = 5 * 60 * 1000;
  if (connection.tokenExpiresAt && connection.tokenExpiresAt < Date.now() + TOKEN_BUFFER_MS) {
    if (!connection.refreshTokenEncrypted) {
      throw new ConvexError("Access token expired and no refresh token available");
    }
    const refreshToken: string = await ctx.runAction(atlassianInternal.oauthActions.decryptToken, {
      encryptedToken: connection.refreshTokenEncrypted,
    });
    const newTokenSet = await ctx.runAction(atlassianInternal.oauthActions.refreshAccessToken, {
      refreshToken,
    });
    accessToken = newTokenSet.accessToken;

    const newAccessEncrypted = await ctx.runAction(atlassianInternal.oauthActions.encryptToken, {
      token: newTokenSet.accessToken,
    });
    const newRefreshEncrypted = newTokenSet.refreshToken
      ? await ctx.runAction(atlassianInternal.oauthActions.encryptToken, {
          token: newTokenSet.refreshToken,
        })
      : connection.refreshTokenEncrypted;

    await ctx.runMutation(atlassianInternal.connections.completeOAuthPersistInternal, {
      connectionId: connection._id,
      accessTokenEncrypted: newAccessEncrypted,
      refreshTokenEncrypted: newRefreshEncrypted,
      tokenExpiresAt: newTokenSet.accessTokenExpiresAt,
      scopes: connection.scopes ?? [],
      atlassianSiteId: connection.atlassianSiteId,
      atlassianSiteUrl: connection.atlassianSiteUrl,
    });
  }

  return {
    accessToken,
    cloudId: connection.atlassianSiteId,
    connection,
  };
}

async function resolveSpaceId(
  ctx: {
    runAction: (...args: any[]) => any;
  },
  accessToken: string,
  cloudId: string,
  spaceKey: string,
): Promise<string> {
  const atlassianInternal = internalApi.atlassian;
  const space = await ctx.runAction(atlassianInternal.oauthActions.resolveSpaceByKey, {
    accessToken,
    cloudId,
    spaceKey,
  });
  if (!space?.id) {
    throw new ConvexError(
      `Confluence space with key "${spaceKey}" not found. Ensure the space exists and OAuth scopes include read:space:confluence.`,
    );
  }
  return String(space.id);
}

export const publishPage = internalAction({
  args: {
    programId: v.id("programs"),
    pageType: v.union(v.literal("program_overview"), v.literal("gap_analysis")),
  },
  handler: async (ctx, args): Promise<any> => {
    const atlassianInternal: any = internalApi.atlassian;

    // 1. Resolve access token and connection
    const { accessToken, cloudId, connection } = await resolveAccessToken(ctx, args.programId);

    // 2. Validate connection bindings
    const spaceKey = connection.confluenceSpaceKey;
    const parentPageId = connection.confluenceParentPageId;
    if (!spaceKey) {
      throw new ConvexError(
        "Confluence space key not configured. Set it in Atlassian connection bindings.",
      );
    }
    if (!parentPageId) {
      throw new ConvexError(
        "Confluence parent page ID not configured. Set it in Atlassian connection bindings.",
      );
    }

    // 3. Resolve spaceId from spaceKey (v2 API needs numeric spaceId)
    const spaceId = await resolveSpaceId(ctx, accessToken, cloudId, spaceKey);

    // 4. Load program data
    const programDoc = await ctx.runQuery(internalApi.programs.getByIdInternal, {
      programId: args.programId,
    });
    if (!programDoc) throw new ConvexError("Program not found");

    // 5. Load workstreams
    const workstreams = await ctx.runQuery(internalApi.workstreams.listByProgramInternal, {
      programId: args.programId,
    });

    // 6. Render content based on pageType
    let html: string;
    let contentHash: string;
    let title: string;

    if (args.pageType === "program_overview") {
      title = `Program Overview - ${programDoc.name}`;
      const rendered = renderProgramOverview(programDoc, workstreams ?? []);
      html = rendered.html;
      contentHash = rendered.contentHash;
    } else {
      // gap_analysis
      title = `Gap Analysis - ${programDoc.name}`;
      const requirements = await ctx.runQuery(internalApi.requirements.listByProgramInternal, {
        programId: args.programId,
      });
      const rendered = renderGapAnalysis(requirements ?? [], workstreams ?? []);
      html = rendered.html;
      contentHash = rendered.contentHash;
    }

    // 7. Check if page already exists in confluencePageRecords
    const existingPages = await ctx.runQuery(
      atlassianInternal.confluence.publish.listPagesByProgramInternal,
      { programId: args.programId },
    );
    const existingPage = (existingPages ?? []).find(
      (p: any) => p.pageType === args.pageType && p.direction === "publish",
    );

    let confluencePageId: string;
    let confluenceVersion: number;

    if (existingPage) {
      // 8a. Update existing page
      const newVersion = (existingPage.confluenceVersion ?? 1) + 1;
      const result = await ctx.runAction(atlassianInternal.oauthActions.updatePage, {
        accessToken,
        cloudId,
        pageId: existingPage.confluencePageId,
        title,
        body: html,
        version: newVersion,
      });
      confluencePageId = existingPage.confluencePageId;
      confluenceVersion = result.version?.number ?? newVersion;
    } else {
      // 8b. Create new page
      const result = await ctx.runAction(atlassianInternal.oauthActions.createPage, {
        accessToken,
        cloudId,
        spaceId,
        parentId: parentPageId,
        title,
        body: html,
      });
      confluencePageId = String(result.id);
      confluenceVersion = result.version?.number ?? 1;
    }

    // 9. Upsert the confluencePageRecords entry
    await ctx.runMutation(atlassianInternal.confluence.publish.upsertPublishedPage, {
      orgId: programDoc.orgId,
      programId: args.programId,
      pageType: args.pageType,
      confluencePageId,
      confluencePageTitle: title,
      confluenceVersion,
      contentHash,
      cachedRenderedHtml: html,
      cachedRenderedVersion: confluenceVersion,
    });

    return {
      success: true,
      pageType: args.pageType,
      confluencePageId,
      confluenceVersion,
      title,
    };
  },
});

export const publishProgramOverview = action({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<any> => {
    const atlassianInternal: any = internalApi.atlassian;
    return await ctx.runAction(atlassianInternal.confluence.publisher.publishPage, {
      programId: args.programId,
      pageType: "program_overview",
    });
  },
});

export const publishGapAnalysis = action({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<any> => {
    const atlassianInternal: any = internalApi.atlassian;
    return await ctx.runAction(atlassianInternal.confluence.publisher.publishPage, {
      programId: args.programId,
      pageType: "gap_analysis",
    });
  },
});

export const publishAllPages = action({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<any> => {
    const atlassianInternal: any = internalApi.atlassian;
    const results: Array<{ pageType: string; success: boolean; error?: string }> = [];

    for (const pageType of PAGE_TYPES) {
      try {
        const result = await ctx.runAction(atlassianInternal.confluence.publisher.publishPage, {
          programId: args.programId,
          pageType,
        });
        results.push({ pageType, success: true, ...result });
      } catch (error: any) {
        results.push({
          pageType,
          success: false,
          error: error.message ?? String(error),
        });
      }
    }

    return { results };
  },
});
