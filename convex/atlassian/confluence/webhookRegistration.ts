"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "../../_generated/api";
import { action } from "../../_generated/server";

const internalApi: any = (generatedApi as any).internal;

const ATLASSIAN_API_BASE = "https://api.atlassian.com";

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

export const registerWebhook = action({
  args: {
    programId: v.id("programs"),
    callbackUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const atlassianInternal = internalApi.atlassian;
    const { accessToken, cloudId } = await resolveAccessToken(ctx, args.programId);

    const connection = await ctx.runQuery(atlassianInternal.connections.getByProgramInternal, {
      programId: args.programId,
    });

    const response = await fetch(
      `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/rest/api/webhooks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          url: args.callbackUrl,
          events: ["page_created", "page_updated", "page_trashed"],
          ...(connection?.confluenceSpaceKey
            ? { filters: { "space.key": connection.confluenceSpaceKey } }
            : {}),
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ConvexError(`Failed to register Confluence webhook (${response.status}): ${body}`);
    }

    const webhook = (await response.json()) as Record<string, any>;
    return { webhookId: String(webhook.id ?? ""), registered: true };
  },
});

export const unregisterWebhook = action({
  args: {
    programId: v.id("programs"),
    webhookId: v.string(),
  },
  handler: async (ctx, args) => {
    const { accessToken, cloudId } = await resolveAccessToken(ctx, args.programId);

    const response = await fetch(
      `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/rest/api/webhooks/${encodeURIComponent(args.webhookId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new ConvexError(
        `Failed to unregister Confluence webhook (${response.status}): ${body}`,
      );
    }

    return { unregistered: true };
  },
});
