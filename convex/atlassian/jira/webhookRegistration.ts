"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "../../_generated/api";
import { internalAction } from "../../_generated/server";

// NOTE: storeWebhookId internalMutation lives in sync.ts (non-node runtime)

const ATLASSIAN_API_BASE = "https://api.atlassian.com";
const internalApi: any = (generatedApi as any).internal;

async function resolveAccessToken(
  ctx: {
    runQuery: (...args: any[]) => any;
    runAction: (...args: any[]) => any;
    runMutation: (...args: any[]) => any;
  },
  programId: any,
): Promise<{ accessToken: string; cloudId: string; connectionId: any }> {
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

  return { accessToken, cloudId: connection.atlassianSiteId, connectionId: connection._id };
}

export const registerWebhook = internalAction({
  args: {
    programId: v.id("programs"),
    webhookUrl: v.string(),
    jqlFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accessToken, cloudId, connectionId } = await resolveAccessToken(ctx, args.programId);
    const atlassianInternal = internalApi.atlassian;

    // Get the connection to check for existing Jira project key for JQL filter
    const connection = await ctx.runQuery(atlassianInternal.connections.getByProgramInternal, {
      programId: args.programId,
    });

    const jqlFilter =
      args.jqlFilter ??
      (connection?.jiraProjectKey
        ? `project = ${connection.jiraProjectKey}`
        : "project IS NOT EMPTY");

    const response = await fetch(`${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/webhook`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhooks: [
          {
            jqlFilter,
            events: ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted"],
            url: args.webhookUrl,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ConvexError(`Failed to register Jira webhook (${response.status}): ${body}`);
    }

    const result = (await response.json()) as Record<string, any>;

    // Extract the webhook ID from the response
    const webhookId =
      result.webhookRegistrationResult?.[0]?.createdWebhookId ?? result.webhooks?.[0]?.id ?? null;

    if (webhookId) {
      // Store webhook ID in the connection record (mutation in sync.ts)
      await ctx.runMutation(atlassianInternal.jira.sync.storeWebhookId, {
        connectionId,
        jiraWebhookId: String(webhookId),
      });
    }

    return { registered: true, webhookId: webhookId ? String(webhookId) : null };
  },
});

export const unregisterWebhook = internalAction({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const { accessToken, cloudId, connectionId } = await resolveAccessToken(ctx, args.programId);
    const atlassianInternal = internalApi.atlassian;

    // Get the stored webhook ID
    const connection = await ctx.runQuery(atlassianInternal.connections.getByProgramInternal, {
      programId: args.programId,
    });

    const webhookId = connection?.webhookIds?.jiraWebhookId;
    if (!webhookId) {
      return { unregistered: false, reason: "No webhook ID stored" };
    }

    const response = await fetch(`${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/webhook`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhookIds: [parseInt(webhookId, 10)],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ConvexError(`Failed to unregister Jira webhook (${response.status}): ${body}`);
    }

    // Clear the webhook ID from the connection (mutation in sync.ts)
    await ctx.runMutation(atlassianInternal.jira.sync.storeWebhookId, {
      connectionId,
      jiraWebhookId: undefined,
    });

    return { unregistered: true };
  },
});
