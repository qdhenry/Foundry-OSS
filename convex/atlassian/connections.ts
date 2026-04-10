import { ConvexError, v } from "convex/values";
import * as generatedApi from "../_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

const internalApi: any = (generatedApi as any).internal;

type OAuthStartConfig = {
  clientId: string;
  redirectUri: string;
  scopes: string[];
};

function getOAuthStartConfig(): OAuthStartConfig {
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const redirectUri = process.env.ATLASSIAN_OAUTH_REDIRECT_URI;
  const scopeString =
    process.env.ATLASSIAN_OAUTH_SCOPES ??
    [
      // Jira scopes
      "read:jira-work",
      "write:jira-work",
      "manage:jira-project",
      "manage:jira-webhook",
      // Confluence classic scopes
      "read:confluence-content.all",
      "write:confluence-content",
      "read:confluence-space.summary",
      "write:confluence-space",
      "write:confluence-file",
      "write:confluence-props",
      "search:confluence",
      // Confluence granular scopes (required for v2 REST API)
      "read:space:confluence",
      "read:page:confluence",
      // Token refresh
      "offline_access",
    ].join(" ");

  if (!clientId || !redirectUri) {
    throw new ConvexError(
      "Atlassian OAuth is not configured (ATLASSIAN_CLIENT_ID, ATLASSIAN_OAUTH_REDIRECT_URI)",
    );
  }

  return {
    clientId,
    redirectUri,
    scopes: scopeString
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  };
}

function buildAuthorizationUrl(state: string, config: OAuthStartConfig): string {
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: config.clientId,
    scope: config.scopes.join(" "),
    redirect_uri: config.redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

function buildStateToken(programId: string): string {
  return `${programId}:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
}

/** Get the Atlassian connection for a program, or null if none exists. */
export const getByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const records = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (records.length === 0) return null;

    return records.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  },
});

/** List all Atlassian connections across programs in an organization. */
export const listByOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const records = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Initiate the Atlassian OAuth flow and return the authorization URL. */
export const startOAuth = mutation({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const config = getOAuthStartConfig();
    const state = buildStateToken(program.slug ?? (args.programId as string));
    const now = Date.now();

    const existing = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "setup_required",
        oauthState: state,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("atlassianConnections", {
        orgId: program.orgId,
        programId: args.programId,
        status: "setup_required",
        oauthState: state,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      state,
      authorizationUrl: buildAuthorizationUrl(state, config),
      redirectUri: config.redirectUri,
    };
  },
});

/**
 * Complete the Atlassian OAuth flow by exchanging the authorization code for tokens.
 * @param state - OAuth state token for CSRF verification
 * @param code - Authorization code from Atlassian
 */
export const completeOAuth = action({
  args: {
    state: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const atlassianInternal: any = internalApi.atlassian;

    const connection = await ctx.runQuery(atlassianInternal.connections.getByOAuthStateInternal, {
      state: args.state,
    });
    if (!connection) {
      throw new ConvexError("Atlassian OAuth state not found");
    }

    const tokenSet = await ctx.runAction(atlassianInternal.oauthActions.exchangeCodeForTokens, {
      code: args.code,
    });

    const resources = await ctx.runAction(
      atlassianInternal.oauthActions.discoverAccessibleResources,
      { accessToken: tokenSet.accessToken },
    );

    const selectedResource =
      resources.find((resource: Record<string, unknown>) => {
        const resourceId = String(resource.id ?? "");
        const resourceUrl = String(resource.url ?? "");
        return (
          (connection.atlassianSiteId && resourceId === connection.atlassianSiteId) ||
          (connection.atlassianSiteUrl &&
            resourceUrl.toLowerCase() === connection.atlassianSiteUrl.toLowerCase())
        );
      }) ?? resources[0];

    const fallbackScopes =
      typeof tokenSet.scope === "string"
        ? tokenSet.scope
            .split(/\s+/)
            .map((scope: string) => scope.trim())
            .filter(Boolean)
        : [];

    const accessTokenEncrypted = await ctx.runAction(atlassianInternal.oauthActions.encryptToken, {
      token: tokenSet.accessToken,
    });

    const refreshTokenEncrypted = tokenSet.refreshToken
      ? await ctx.runAction(atlassianInternal.oauthActions.encryptToken, {
          token: tokenSet.refreshToken,
        })
      : undefined;

    await ctx.runMutation(atlassianInternal.connections.completeOAuthPersistInternal, {
      connectionId: connection._id,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt: tokenSet.accessTokenExpiresAt,
      scopes: selectedResource?.scopes ?? fallbackScopes,
      atlassianSiteId: typeof selectedResource?.id === "string" ? selectedResource.id : undefined,
      atlassianSiteUrl:
        typeof selectedResource?.url === "string" ? selectedResource.url : undefined,
    });

    return {
      connectionId: connection._id,
      status: "connected",
      atlassianSiteId: selectedResource?.id ?? null,
      atlassianSiteUrl: selectedResource?.url ?? null,
    };
  },
});

/**
 * Update Jira/Confluence project bindings on an Atlassian connection.
 * @param programId - The program whose connection to update
 */
export const updateBindings = mutation({
  args: {
    programId: v.id("programs"),
    jiraProjectId: v.optional(v.string()),
    jiraProjectKey: v.optional(v.string()),
    confluenceSpaceKey: v.optional(v.string()),
    confluenceParentPageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const connection = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .first();

    if (!connection) {
      throw new ConvexError("Atlassian connection not found for program");
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.jiraProjectId !== undefined) {
      patch.jiraProjectId = args.jiraProjectId || undefined;
    }
    if (args.jiraProjectKey !== undefined) {
      patch.jiraProjectKey = args.jiraProjectKey || undefined;
    }
    if (args.confluenceSpaceKey !== undefined) {
      patch.confluenceSpaceKey = args.confluenceSpaceKey || undefined;
    }
    if (args.confluenceParentPageId !== undefined) {
      patch.confluenceParentPageId = args.confluenceParentPageId || undefined;
    }

    await ctx.db.patch(connection._id, patch);
  },
});

/** Disconnect the Atlassian integration for a program and revoke stored tokens. */
export const disconnect = mutation({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const connection = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .first();

    if (!connection) {
      throw new ConvexError("Atlassian connection not found for program");
    }

    await ctx.db.patch(connection._id, {
      status: "disconnected",
      oauthState: undefined,
      accessTokenEncrypted: undefined,
      refreshTokenEncrypted: undefined,
      tokenExpiresAt: undefined,
      disconnectedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getByProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    if (records.length === 0) return null;
    return records.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  },
});

export const getByOAuthStateInternal = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("atlassianConnections")
      .withIndex("by_oauth_state", (q) => q.eq("oauthState", args.state))
      .first();
  },
});

export const getBySiteIdInternal = internalQuery({
  args: { atlassianSiteId: v.string() },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_site_id", (q) => q.eq("atlassianSiteId", args.atlassianSiteId))
      .collect();

    return candidates.filter((connection) => connection.status === "connected");
  },
});

export const completeOAuthPersistInternal = internalMutation({
  args: {
    connectionId: v.id("atlassianConnections"),
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    tokenExpiresAt: v.number(),
    scopes: v.array(v.string()),
    atlassianSiteId: v.optional(v.string()),
    atlassianSiteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.connectionId);
    if (!existing) throw new ConvexError("Atlassian connection not found");

    await ctx.db.patch(args.connectionId, {
      status: "connected",
      oauthState: undefined,
      accessTokenEncrypted: args.accessTokenEncrypted,
      refreshTokenEncrypted: args.refreshTokenEncrypted,
      tokenExpiresAt: args.tokenExpiresAt,
      scopes: args.scopes,
      atlassianSiteId: args.atlassianSiteId,
      atlassianSiteUrl: args.atlassianSiteUrl,
      disconnectedAt: undefined,
      connectedAt: Date.now(),
      updatedAt: Date.now(),
      lastSyncAt: Date.now(),
    });
  },
});

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

  return { accessToken, cloudId: connection.atlassianSiteId };
}

export const listProjects = action({
  args: { programId: v.id("programs") },
  handler: async (ctx, args): Promise<any> => {
    const { accessToken, cloudId } = await resolveAccessToken(ctx, args.programId);
    const atlassianInternal: any = internalApi.atlassian;
    return await ctx.runAction(atlassianInternal.oauthActions.fetchJiraProjects, {
      accessToken,
      cloudId,
    });
  },
});

export const listSpaces = action({
  args: { programId: v.id("programs") },
  handler: async (ctx, args): Promise<any> => {
    const { accessToken, cloudId } = await resolveAccessToken(ctx, args.programId);
    const atlassianInternal: any = internalApi.atlassian;
    return await ctx.runAction(atlassianInternal.oauthActions.fetchConfluenceSpaces, {
      accessToken,
      cloudId,
    });
  },
});

export const listPages = action({
  args: { programId: v.id("programs"), spaceId: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const { accessToken, cloudId } = await resolveAccessToken(ctx, args.programId);
    const atlassianInternal: any = internalApi.atlassian;
    return await ctx.runAction(atlassianInternal.oauthActions.fetchConfluencePages, {
      accessToken,
      cloudId,
      spaceId: args.spaceId,
    });
  },
});
