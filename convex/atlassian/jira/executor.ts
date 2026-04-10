"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "../../_generated/api";
import { internalAction } from "../../_generated/server";

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

export const executeQueueItem = internalAction({
  args: {
    queueItemId: v.id("jiraSyncQueue"),
  },
  handler: async (ctx, args) => {
    const atlassianInternal = internalApi.atlassian;

    const item = await ctx.runQuery(atlassianInternal.jira.push.getQueueItemInternal, {
      queueItemId: args.queueItemId,
    });
    if (!item) throw new ConvexError("Queue item not found");

    const { accessToken, cloudId } = await resolveAccessToken(ctx, item.programId);

    let jiraResponse: Record<string, any>;

    switch (item.operationType) {
      case "create_issue": {
        jiraResponse = await ctx.runAction(atlassianInternal.oauthActions.createIssue, {
          accessToken,
          cloudId,
          fields: item.payload.fields,
        });
        break;
      }
      case "update_issue": {
        jiraResponse = await ctx.runAction(atlassianInternal.oauthActions.updateIssue, {
          accessToken,
          cloudId,
          issueKey: item.payload.issueKey,
          fields: item.payload.fields,
        });
        break;
      }
      case "transition_issue": {
        jiraResponse = await ctx.runAction(atlassianInternal.oauthActions.transitionIssue, {
          accessToken,
          cloudId,
          issueKey: item.payload.issueKey,
          transitionId: item.payload.transitionId,
        });
        break;
      }
      case "add_comment": {
        jiraResponse = await ctx.runAction(atlassianInternal.oauthActions.addComment, {
          accessToken,
          cloudId,
          issueKey: item.payload.issueKey,
          body: item.payload.body,
        });
        break;
      }
      default:
        throw new ConvexError(`Unsupported operation type: ${item.operationType}`);
    }

    await ctx.runMutation(atlassianInternal.jira.push.markQueueItemExecuted, {
      queueItemId: args.queueItemId,
      jiraResponse,
    });

    if (item.operationType === "create_issue" && jiraResponse) {
      const platformEntityType = item.payload.platformEntityType ?? "task";
      await ctx.runMutation(atlassianInternal.jira.sync.upsertSyncRecordInternal, {
        orgId: item.orgId,
        programId: item.programId,
        platformEntityType,
        platformEntityId: item.platformEntityId,
        jiraIssueId: jiraResponse.id,
        jiraIssueKey: jiraResponse.key,
        jiraIssueType: item.payload.fields?.issuetype?.name,
        syncDirection: "push" as const,
        lastPushAt: Date.now(),
        conflictStatus: "none" as const,
      });
    }

    return jiraResponse;
  },
});
