import { ConvexError, v } from "convex/values";
import * as generatedApi from "../_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { logAuditEvent } from "../model/audit";
import { assertActionOrgAccess, authorizeCredentialOwner } from "./auth";

const internalApi: any = (generatedApi as any).internal;

// One-time import scope (read-only Drive access + refresh token)
const GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly", "openid", "email"];

function buildGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new ConvexError(
      "Google Drive OAuth is not configured (GOOGLE_CLIENT_ID, GOOGLE_OAUTH_REDIRECT_URI)",
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildStateToken(): string {
  return `${Date.now()}:${Math.random().toString(36).slice(2, 14)}`;
}

// ── Public Queries ────────────────────────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const credentials = await ctx.db
      .query("googleDriveCredentials")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Strip encrypted tokens before returning to client
    return credentials.map(
      ({ accessTokenEncrypted: _a, refreshTokenEncrypted: _r, ...rest }) => rest,
    );
  },
});

export const getMyCredential = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);

    const credential = await ctx.db
      .query("googleDriveCredentials")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", user._id))
      .first();

    if (!credential) return null;

    const { accessTokenEncrypted: _a, refreshTokenEncrypted: _r, ...rest } = credential;
    return rest;
  },
});

// ── OAuth Flow ────────────────────────────────────────────────────────

export const startOAuth = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);
    const state = buildStateToken();
    const now = Date.now();

    const existing = await ctx.db
      .query("googleDriveCredentials")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        oauthState: state,
        status: "expired",
      });
    } else {
      await ctx.db.insert("googleDriveCredentials", {
        orgId: args.orgId,
        userId: user._id,
        status: "expired",
        oauthState: state,
        connectedAt: now,
      });
    }

    return {
      state,
      authorizationUrl: buildGoogleAuthUrl(state),
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
    };
  },
});

export const completeOAuth = action({
  args: {
    state: v.string(),
    code: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ credentialId: string; status: string; googleEmail: string }> => {
    const gDriveInternal: any = internalApi.googleDrive;

    // Validate state
    const credential = await ctx.runQuery(gDriveInternal.credentials.getByOAuthStateInternal, {
      state: args.state,
    });
    if (!credential) {
      throw new ConvexError("Google Drive OAuth state not found or expired");
    }

    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (!redirectUri) {
      throw new ConvexError("Missing GOOGLE_OAUTH_REDIRECT_URI");
    }

    // Exchange code for tokens
    const tokenData = await ctx.runAction(gDriveInternal.oauthActions.exchangeCodeForTokens, {
      code: args.code,
      redirectUri,
    });

    // Fetch Google account identity
    const userInfo = await ctx.runAction(gDriveInternal.oauthActions.fetchGoogleUserInfo, {
      accessToken: tokenData.accessToken,
    });

    // Encrypt tokens
    const accessTokenEncrypted: string = await ctx.runAction(
      gDriveInternal.oauthActions.encryptToken,
      { token: tokenData.accessToken },
    );

    const refreshTokenEncrypted: string | undefined = tokenData.refreshToken
      ? await ctx.runAction(gDriveInternal.oauthActions.encryptToken, {
          token: tokenData.refreshToken,
        })
      : undefined;

    // Persist
    await ctx.runMutation(gDriveInternal.credentials.completeOAuthPersistInternal, {
      credentialId: credential._id,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt: Date.now() + tokenData.expiresIn * 1000,
      scopes: tokenData.scopes,
      googleEmail: userInfo.email,
      googleUserId: userInfo.id,
    });

    return {
      credentialId: credential._id,
      status: "active",
      googleEmail: userInfo.email,
    };
  },
});

export const revoke = mutation({
  args: { credentialId: v.id("googleDriveCredentials") },
  handler: async (ctx, args) => {
    const credential = await ctx.db.get(args.credentialId);
    if (!credential) throw new ConvexError("Credential not found");
    await assertOrgAccess(ctx, credential.orgId);

    await ctx.db.patch(args.credentialId, {
      status: "revoked",
      accessTokenEncrypted: undefined,
      refreshTokenEncrypted: undefined,
      oauthState: undefined,
    });
  },
});

// ── Internal Queries ──────────────────────────────────────────────────

export const getByOAuthStateInternal = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleDriveCredentials")
      .withIndex("by_oauth_state", (q) => q.eq("oauthState", args.state))
      .first();
  },
});

export const getByUserInternal = internalQuery({
  args: { orgId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleDriveCredentials")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", args.userId))
      .first();
  },
});

export const getByIdInternal = internalQuery({
  args: { credentialId: v.id("googleDriveCredentials") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.credentialId);
  },
});

// ── Internal Mutations ────────────────────────────────────────────────

export const completeOAuthPersistInternal = internalMutation({
  args: {
    credentialId: v.id("googleDriveCredentials"),
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    tokenExpiresAt: v.number(),
    scopes: v.array(v.string()),
    googleEmail: v.string(),
    googleUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.credentialId);
    if (!existing) throw new ConvexError("Credential not found");

    await ctx.db.patch(args.credentialId, {
      status: "active",
      oauthState: undefined,
      accessTokenEncrypted: args.accessTokenEncrypted,
      refreshTokenEncrypted: args.refreshTokenEncrypted,
      tokenExpiresAt: args.tokenExpiresAt,
      scopes: args.scopes,
      googleEmail: args.googleEmail,
      googleUserId: args.googleUserId,
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
    });
  },
});

export const markTokenRefreshedInternal = internalMutation({
  args: {
    credentialId: v.id("googleDriveCredentials"),
    accessTokenEncrypted: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.credentialId, {
      accessTokenEncrypted: args.accessTokenEncrypted,
      tokenExpiresAt: args.tokenExpiresAt,
      lastUsedAt: Date.now(),
    });
  },
});

export const markExpiredInternal = internalMutation({
  args: { credentialId: v.id("googleDriveCredentials") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.credentialId, {
      status: "expired",
      accessTokenEncrypted: undefined,
    });
  },
});

// ── Token Resolution (sandwich pattern for download actions) ──────────

/**
 * Returns a valid (possibly refreshed) plaintext access token.
 * Used by Drive download/export actions before calling the Drive API.
 */
export const resolveAccessTokenInternal = internalAction({
  args: { credentialId: v.id("googleDriveCredentials") },
  handler: async (ctx, args): Promise<string> => {
    const gDriveInternal: any = internalApi.googleDrive;

    const credential = await ctx.runQuery(gDriveInternal.credentials.getByIdInternal, {
      credentialId: args.credentialId,
    });

    if (!credential) throw new ConvexError("Google Drive credential not found");
    if (credential.status === "revoked")
      throw new ConvexError("Google Drive connection has been revoked");
    if (!credential.accessTokenEncrypted || !credential.refreshTokenEncrypted)
      throw new ConvexError("Google Drive tokens missing — please reconnect your account");

    // Return existing token if still valid (with 60s buffer)
    const now = Date.now();
    if (credential.tokenExpiresAt && credential.tokenExpiresAt > now + 60_000) {
      return await ctx.runAction(gDriveInternal.oauthActions.decryptToken, {
        encryptedToken: credential.accessTokenEncrypted,
      });
    }

    // Token expired — attempt refresh
    const refreshToken: string = await ctx.runAction(gDriveInternal.oauthActions.decryptToken, {
      encryptedToken: credential.refreshTokenEncrypted,
    });

    let newTokenData: { accessToken: string; expiresIn: number };
    try {
      newTokenData = await ctx.runAction(gDriveInternal.oauthActions.refreshAccessToken, {
        refreshToken,
      });
    } catch {
      // Mark credential as expired so UI can prompt re-auth
      await ctx.runMutation(gDriveInternal.credentials.markExpiredInternal, {
        credentialId: args.credentialId,
      });
      throw new ConvexError("Google Drive token refresh failed — please reconnect your account");
    }

    const newEncrypted: string = await ctx.runAction(gDriveInternal.oauthActions.encryptToken, {
      token: newTokenData.accessToken,
    });

    await ctx.runMutation(gDriveInternal.credentials.markTokenRefreshedInternal, {
      credentialId: args.credentialId,
      accessTokenEncrypted: newEncrypted,
      tokenExpiresAt: now + newTokenData.expiresIn * 1000,
    });

    return newTokenData.accessToken;
  },
});

// ── Access Token for Google Picker ───────────────────────────────────

/**
 * Returns a valid (possibly refreshed) plaintext access token for the
 * Google Picker SDK. Called client-side before opening the file picker.
 */
export const getAccessTokenForPicker = action({
  args: {
    orgId: v.string(),
    credentialId: v.id("googleDriveCredentials"),
  },
  handler: async (ctx, args): Promise<string> => {
    const gDriveInternal: any = internalApi.googleDrive;

    await authorizeCredentialOwner(ctx, args);

    return await ctx.runAction(gDriveInternal.credentials.resolveAccessTokenInternal, {
      credentialId: args.credentialId,
    });
  },
});

// ── Batch Duplicate Detection ─────────────────────────────────────────

/**
 * Checks multiple Drive file IDs against a program's document list.
 * Used by the frontend to warn before re-importing already-imported files.
 */
export const checkBatchDuplicates = action({
  args: {
    programId: v.id("programs"),
    driveFileIds: v.array(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Array<{ driveFileId: string; fileName: string; importedAt: number }>> => {
    const gDriveInternal: any = internalApi.googleDrive;
    const program = await ctx.runQuery(internalApi.programs.getByIdInternal, {
      programId: args.programId,
    });
    if (!program) throw new ConvexError("Program not found");

    await assertActionOrgAccess(ctx, program.orgId);

    const duplicates: Array<{
      driveFileId: string;
      fileName: string;
      importedAt: number;
    }> = [];

    for (const driveFileId of args.driveFileIds) {
      const existing = await ctx.runQuery(
        gDriveInternal.credentials.checkDuplicateDriveFileInternal,
        { programId: args.programId, driveFileId },
      );
      if (existing) {
        duplicates.push({
          driveFileId,
          fileName: existing.fileName,
          importedAt: existing._creationTime,
        });
      }
    }

    return duplicates;
  },
});

// ── Duplicate Detection ───────────────────────────────────────────────

/** Public query — lets frontend warn users before re-importing the same Drive file. */
export const checkDuplicateDriveFile = query({
  args: {
    programId: v.id("programs"),
    driveFileId: v.string(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) return null;
    await assertOrgAccess(ctx, program.orgId);

    const existing = await ctx.db
      .query("documents")
      .withIndex("by_program_drive_file", (q) =>
        q.eq("programId", args.programId).eq("driveFileId", args.driveFileId),
      )
      .first();

    if (!existing) return null;
    return {
      documentId: existing._id,
      fileName: existing.fileName,
      importedAt: existing._creationTime,
    };
  },
});

export const checkDuplicateDriveFileInternal = internalQuery({
  args: {
    programId: v.id("programs"),
    driveFileId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_program_drive_file", (q) =>
        q.eq("programId", args.programId).eq("driveFileId", args.driveFileId),
      )
      .first();
  },
});

// ── Storage + Document Persistence (called from driveActions) ─────────

export const generateStorageUploadUrlInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDriveDocumentInternal = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    category: v.union(
      v.literal("architecture"),
      v.literal("requirements"),
      v.literal("testing"),
      v.literal("deployment"),
      v.literal("meeting_notes"),
      v.literal("other"),
    ),
    uploadedBy: v.id("users"),
    credentialId: v.id("googleDriveCredentials"),
    googleEmail: v.optional(v.string()),
    driveFileId: v.string(),
    driveFileName: v.string(),
    driveMimeType: v.string(),
    driveWebViewLink: v.optional(v.string()),
    driveModifiedTime: v.optional(v.string()),
    driveVersion: v.optional(v.string()),
    isReimport: v.boolean(),
  },
  handler: async (ctx, args) => {
    const documentId = await ctx.db.insert("documents", {
      orgId: args.orgId,
      programId: args.programId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      category: args.category,
      uploadedBy: args.uploadedBy,
      source: "google_drive",
      driveFileId: args.driveFileId,
      driveFileName: args.driveFileName,
      driveMimeType: args.driveMimeType,
      driveWebViewLink: args.driveWebViewLink,
      driveModifiedTime: args.driveModifiedTime,
      driveVersion: args.driveVersion,
      importedByCredentialId: args.credentialId,
      analysisStatus: "none",
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "document",
      entityId: documentId as string,
      action: args.isReimport ? "update" : "create",
      description: args.isReimport
        ? `Re-imported "${args.driveFileName}" from Google Drive (${args.googleEmail ?? "unknown account"})`
        : `Imported "${args.driveFileName}" from Google Drive (${args.googleEmail ?? "unknown account"})`,
      metadata: {
        source: "google_drive",
        driveFileId: args.driveFileId,
        driveMimeType: args.driveMimeType,
        googleEmail: args.googleEmail,
      },
    });

    await ctx.db.insert("activityEvents", {
      orgId: args.orgId,
      programId: args.programId,
      page: "discovery",
      eventType: "document_uploaded",
      message: args.isReimport
        ? `Re-imported ${args.driveFileName} from Google Drive`
        : `Imported ${args.driveFileName} from Google Drive`,
      entityType: "document",
      entityId: documentId as string,
      userId: args.uploadedBy,
      userName: args.googleEmail ?? "Google Drive",
      createdAt: Date.now(),
    });

    return documentId;
  },
});
