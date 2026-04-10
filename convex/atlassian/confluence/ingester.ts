"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "../../_generated/api";
import { action, internalAction } from "../../_generated/server";

const internalApi: any = (generatedApi as any).internal;

async function resolveAccessToken(
  ctx: {
    runQuery: (...args: any[]) => any;
    runAction: (...args: any[]) => any;
    runMutation: (...args: any[]) => any;
  },
  programId: any,
): Promise<{ accessToken: string; cloudId: string }> {
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

  return { accessToken, cloudId: connection.atlassianSiteId };
}

export const processIngestedPage = internalAction({
  args: {
    programId: v.id("programs"),
    confluencePageId: v.string(),
    confluencePageTitle: v.string(),
    confluenceVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const atlassianInternal = internalApi.atlassian;

    const { accessToken, cloudId } = await resolveAccessToken(ctx, args.programId);

    const pageData = await ctx.runAction(
      atlassianInternal.oauthActions.fetchConfluencePageContent,
      { accessToken, cloudId, pageId: args.confluencePageId },
    );

    const bodyHtml = pageData?.body?.storage?.value ?? "";
    const version = pageData?.version?.number ?? args.confluenceVersion;
    const contentHash = `${version}:${String(bodyHtml).length}`;

    // Check existing record for content hash match
    const existing = await ctx.runQuery(atlassianInternal.confluence.ingest.getPageRecordQuery, {
      programId: args.programId,
      confluencePageId: args.confluencePageId,
    });

    if (existing && existing.contentHash === contentHash) {
      return { processed: true, changed: false };
    }

    // Upsert the page record with full content
    await ctx.runMutation(atlassianInternal.confluence.ingest.upsertIngestedPageRecord, {
      programId: args.programId,
      confluencePageId: args.confluencePageId,
      confluencePageTitle: pageData?.title ?? args.confluencePageTitle,
      confluenceVersion: version,
      contentHash,
      cachedRenderedHtml: bodyHtml,
    });

    return { processed: true, changed: true };
  },
});

export const triggerManualIngest = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    confluencePageId: v.string(),
    confluencePageTitle: v.string(),
    confluenceVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const atlassianInternal = internalApi.atlassian;

    // First call queueManualIngest mutation to create/update the record
    await ctx.runMutation(atlassianInternal.confluence.ingest.queueManualIngest, {
      orgId: args.orgId,
      programId: args.programId,
      confluencePageId: args.confluencePageId,
      confluencePageTitle: args.confluencePageTitle,
      confluenceVersion: args.confluenceVersion,
    });

    // Then schedule the full content fetch
    await ctx.scheduler.runAfter(0, atlassianInternal.confluence.ingester.processIngestedPage, {
      programId: args.programId,
      confluencePageId: args.confluencePageId,
      confluencePageTitle: args.confluencePageTitle,
      confluenceVersion: args.confluenceVersion,
    });

    return { scheduled: true };
  },
});
