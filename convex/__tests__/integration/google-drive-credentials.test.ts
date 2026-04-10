import { convexTest } from "convex-test";
import { beforeAll, describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";
import {
  CLERK_USER_ID,
  ORG_ID,
  seedActiveCredential,
  seedDocumentForDuplicateCheck,
  seedGoogleDriveOrg,
} from "../helpers/googleDriveFactory";

/**
 * Integration tests for convex/googleDrive/credentials.ts
 * Covers: listByOrg, getMyCredential, startOAuth, revoke,
 * checkDuplicateDriveFile, completeOAuthPersistInternal,
 * markTokenRefreshedInternal, markExpiredInternal,
 * saveDriveDocumentInternal, generateStorageUploadUrlInternal.
 */

// Set up env vars required by startOAuth → buildGoogleAuthUrl
beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://example.com/api/auth/google/callback";
});

// ── listByOrg ────────────────────────────────────────────────────────

describe("credentials.listByOrg", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    await seedGoogleDriveOrg(t);

    await expect(
      t.query(apiAny.googleDrive.credentials.listByOrg, { orgId: ORG_ID }),
    ).rejects.toThrow();
  });

  test("throws when user is not in org", async () => {
    const t = convexTest(schema, modules);
    // Seed a user that is NOT in ORG_ID
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkId: "other-user",
        email: "other@example.com",
        name: "Other User",
        orgIds: ["org-other"],
        role: "admin",
      });
    });

    const asOtherUser = t.withIdentity({ subject: "other-user" });
    await expect(
      asOtherUser.query(apiAny.googleDrive.credentials.listByOrg, {
        orgId: ORG_ID,
      }),
    ).rejects.toThrow();
  });

  test("returns empty array when no credentials exist", async () => {
    const t = convexTest(schema, modules);
    await seedGoogleDriveOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.query(apiAny.googleDrive.credentials.listByOrg, { orgId: ORG_ID });
    expect(result).toEqual([]);
  });

  test("returns credentials with encrypted tokens stripped", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    await seedActiveCredential(t, { userId, orgId: ORG_ID });
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.query(apiAny.googleDrive.credentials.listByOrg, { orgId: ORG_ID });

    expect(result).toHaveLength(1);
    expect(result[0].orgId).toBe(ORG_ID);
    expect(result[0].status).toBe("active");
    expect(result[0].googleEmail).toBe("gdrive@gmail.com");
    // Tokens must be stripped
    expect(result[0].accessTokenEncrypted).toBeUndefined();
    expect(result[0].refreshTokenEncrypted).toBeUndefined();
  });

  test("does not return credentials from a different org", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    // Seed an extra user in a different org with a credential
    const otherUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "other-gdrive-user",
        email: "other@example.com",
        name: "Other GDrive User",
        orgIds: ["org-other"],
        role: "admin",
      });
    });
    await t.run(async (ctx: any) => {
      await ctx.db.insert("googleDriveCredentials", {
        orgId: "org-other",
        userId: otherUserId,
        status: "active",
        connectedAt: Date.now(),
      });
    });

    await seedActiveCredential(t, { userId, orgId: ORG_ID });
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.query(apiAny.googleDrive.credentials.listByOrg, { orgId: ORG_ID });
    // Should only see ORG_ID credentials
    expect(result).toHaveLength(1);
    expect(result[0].orgId).toBe(ORG_ID);
  });
});

// ── getMyCredential ──────────────────────────────────────────────────

describe("credentials.getMyCredential", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    await seedGoogleDriveOrg(t);

    await expect(
      t.query(apiAny.googleDrive.credentials.getMyCredential, { orgId: ORG_ID }),
    ).rejects.toThrow();
  });

  test("throws when user is not in org", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkId: "wrong-org-user",
        email: "wrong@example.com",
        name: "Wrong Org User",
        orgIds: ["org-wrong"],
        role: "admin",
      });
    });
    const asUser = t.withIdentity({ subject: "wrong-org-user" });

    await expect(
      asUser.query(apiAny.googleDrive.credentials.getMyCredential, {
        orgId: ORG_ID,
      }),
    ).rejects.toThrow();
  });

  test("returns null when no credential for this user", async () => {
    const t = convexTest(schema, modules);
    await seedGoogleDriveOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.query(apiAny.googleDrive.credentials.getMyCredential, {
      orgId: ORG_ID,
    });
    expect(result).toBeNull();
  });

  test("returns credential without encrypted tokens", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    await seedActiveCredential(t, { userId, orgId: ORG_ID });
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.query(apiAny.googleDrive.credentials.getMyCredential, {
      orgId: ORG_ID,
    });

    expect(result).not.toBeNull();
    expect(result.status).toBe("active");
    expect(result.googleEmail).toBe("gdrive@gmail.com");
    expect(result.accessTokenEncrypted).toBeUndefined();
    expect(result.refreshTokenEncrypted).toBeUndefined();
  });
});

// ── startOAuth ───────────────────────────────────────────────────────

describe("credentials.startOAuth", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    await seedGoogleDriveOrg(t);

    await expect(
      t.mutation(apiAny.googleDrive.credentials.startOAuth, { orgId: ORG_ID }),
    ).rejects.toThrow();
  });

  test("throws when user is not in org", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkId: "outsider-user",
        email: "outsider@example.com",
        name: "Outsider",
        orgIds: ["org-different"],
        role: "admin",
      });
    });
    const asUser = t.withIdentity({ subject: "outsider-user" });

    await expect(
      asUser.mutation(apiAny.googleDrive.credentials.startOAuth, {
        orgId: ORG_ID,
      }),
    ).rejects.toThrow();
  });

  test("creates a new credential in expired status when none exists", async () => {
    const t = convexTest(schema, modules);
    await seedGoogleDriveOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.mutation(apiAny.googleDrive.credentials.startOAuth, {
      orgId: ORG_ID,
    });

    expect(result.state).toBeDefined();
    expect(result.authorizationUrl).toContain("accounts.google.com");
    expect(result.authorizationUrl).toContain("test-google-client-id");

    // Verify credential was created
    const creds = await asUser.query(apiAny.googleDrive.credentials.listByOrg, { orgId: ORG_ID });
    expect(creds).toHaveLength(1);
    expect(creds[0].status).toBe("expired");
  });

  test("updates oauthState when credential already exists", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    await seedActiveCredential(t, { userId, orgId: ORG_ID });
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.mutation(apiAny.googleDrive.credentials.startOAuth, {
      orgId: ORG_ID,
    });

    expect(result.state).toBeDefined();

    // Still only one credential (updated, not inserted)
    const creds = await asUser.query(apiAny.googleDrive.credentials.listByOrg, { orgId: ORG_ID });
    expect(creds).toHaveLength(1);
    expect(creds[0].status).toBe("expired");
  });
});

// ── revoke ───────────────────────────────────────────────────────────

describe("credentials.revoke", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    const credId = await seedActiveCredential(t, { userId, orgId: ORG_ID });

    await expect(
      t.mutation(apiAny.googleDrive.credentials.revoke, {
        credentialId: credId,
      }),
    ).rejects.toThrow();
  });

  test("throws when credential belongs to a different org", async () => {
    const t = convexTest(schema, modules);
    // User is in ORG_ID but credential is in org-other
    const { userId } = await seedGoogleDriveOrg(t);

    const otherUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "other-owner",
        email: "other-owner@example.com",
        name: "Other Owner",
        orgIds: ["org-other"],
        role: "admin",
      });
    });
    const credId = await seedActiveCredential(t, {
      userId: otherUserId,
      orgId: "org-other",
    });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    await expect(
      asUser.mutation(apiAny.googleDrive.credentials.revoke, {
        credentialId: credId,
      }),
    ).rejects.toThrow();
  });

  test("sets status to revoked and clears tokens", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    const credId = await seedActiveCredential(t, { userId, orgId: ORG_ID });
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    await asUser.mutation(apiAny.googleDrive.credentials.revoke, {
      credentialId: credId,
    });

    const cred = await t.run(async (ctx: any) => ctx.db.get(credId));
    expect(cred.status).toBe("revoked");
    expect(cred.accessTokenEncrypted).toBeUndefined();
    expect(cred.refreshTokenEncrypted).toBeUndefined();
    expect(cred.oauthState).toBeUndefined();
  });
});

// ── checkDuplicateDriveFile ──────────────────────────────────────────

describe("credentials.checkDuplicateDriveFile", () => {
  test("returns null when program does not exist", async () => {
    const t = convexTest(schema, modules);
    await seedGoogleDriveOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    // Use a valid-looking program ID that doesn't exist
    const fakeProgramId = await t.run(async (ctx: any) => {
      const id = await ctx.db.insert("programs", {
        orgId: ORG_ID,
        name: "Temp",
        clientName: "Temp",
        phase: "discovery",
        status: "active",
      });
      await ctx.db.delete(id);
      return id;
    });

    const result = await asUser.query(apiAny.googleDrive.credentials.checkDuplicateDriveFile, {
      programId: fakeProgramId,
      driveFileId: "file-xyz",
    });
    expect(result).toBeNull();
  });

  test("returns null when no matching driveFileId", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedGoogleDriveOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.query(apiAny.googleDrive.credentials.checkDuplicateDriveFile, {
      programId,
      driveFileId: "non-existent-file-id",
    });
    expect(result).toBeNull();
  });

  test("returns document info when duplicate exists", async () => {
    const t = convexTest(schema, modules);
    const { userId, programId } = await seedGoogleDriveOrg(t);
    const driveFileId = "gdrive-file-abc123";
    await seedDocumentForDuplicateCheck(t, {
      orgId: ORG_ID,
      programId,
      userId,
      driveFileId,
    });
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const result = await asUser.query(apiAny.googleDrive.credentials.checkDuplicateDriveFile, {
      programId,
      driveFileId,
    });

    expect(result).not.toBeNull();
    expect(result.documentId).toBeDefined();
    expect(result.fileName).toContain(driveFileId);
    expect(result.importedAt).toBeDefined();
  });

  test("throws when user is not in program's org", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedGoogleDriveOrg(t);
    // User in different org
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkId: "outside-user",
        email: "outside@example.com",
        name: "Outside User",
        orgIds: ["org-outside"],
        role: "admin",
      });
    });
    const asOutside = t.withIdentity({ subject: "outside-user" });

    await expect(
      asOutside.query(apiAny.googleDrive.credentials.checkDuplicateDriveFile, {
        programId,
        driveFileId: "any-file",
      }),
    ).rejects.toThrow();
  });
});

// ── completeOAuthPersistInternal ─────────────────────────────────────

describe("credentials.completeOAuthPersistInternal", () => {
  test("throws when credential does not exist", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    const credId = await seedActiveCredential(t, { userId, orgId: ORG_ID });

    // Delete the credential so it doesn't exist
    await t.run(async (ctx: any) => ctx.db.delete(credId));

    await expect(
      t.mutation(internalAny.googleDrive.credentials.completeOAuthPersistInternal, {
        credentialId: credId,
        accessTokenEncrypted: "enc-token",
        tokenExpiresAt: Date.now() + 3600000,
        scopes: ["drive.readonly"],
        googleEmail: "user@gmail.com",
        googleUserId: "gid-123",
      }),
    ).rejects.toThrow();
  });

  test("patches credential with active status and token data", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);

    // Start with an expired credential (no tokens)
    const credId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("googleDriveCredentials", {
        orgId: ORG_ID,
        userId,
        status: "expired",
        oauthState: "some-state-token",
        connectedAt: Date.now(),
      });
    });

    const expiry = Date.now() + 3_600_000;
    await t.mutation(internalAny.googleDrive.credentials.completeOAuthPersistInternal, {
      credentialId: credId,
      accessTokenEncrypted: "enc-access-token",
      refreshTokenEncrypted: "enc-refresh-token",
      tokenExpiresAt: expiry,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      googleEmail: "completed@gmail.com",
      googleUserId: "gid-456",
    });

    const cred = await t.run(async (ctx: any) => ctx.db.get(credId));
    expect(cred.status).toBe("active");
    expect(cred.oauthState).toBeUndefined();
    expect(cred.accessTokenEncrypted).toBe("enc-access-token");
    expect(cred.refreshTokenEncrypted).toBe("enc-refresh-token");
    expect(cred.tokenExpiresAt).toBe(expiry);
    expect(cred.googleEmail).toBe("completed@gmail.com");
    expect(cred.googleUserId).toBe("gid-456");
    expect(cred.connectedAt).toBeDefined();
    expect(cred.lastUsedAt).toBeDefined();
  });
});

// ── markTokenRefreshedInternal ───────────────────────────────────────

describe("credentials.markTokenRefreshedInternal", () => {
  test("updates encrypted access token and expiry", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    const credId = await seedActiveCredential(t, { userId, orgId: ORG_ID });

    const newExpiry = Date.now() + 7_200_000;
    await t.mutation(internalAny.googleDrive.credentials.markTokenRefreshedInternal, {
      credentialId: credId,
      accessTokenEncrypted: "new-enc-access-token",
      tokenExpiresAt: newExpiry,
    });

    const cred = await t.run(async (ctx: any) => ctx.db.get(credId));
    expect(cred.accessTokenEncrypted).toBe("new-enc-access-token");
    expect(cred.tokenExpiresAt).toBe(newExpiry);
    expect(cred.lastUsedAt).toBeDefined();
  });
});

// ── markExpiredInternal ──────────────────────────────────────────────

describe("credentials.markExpiredInternal", () => {
  test("sets status to expired and clears access token", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    const credId = await seedActiveCredential(t, { userId, orgId: ORG_ID });

    await t.mutation(internalAny.googleDrive.credentials.markExpiredInternal, {
      credentialId: credId,
    });

    const cred = await t.run(async (ctx: any) => ctx.db.get(credId));
    expect(cred.status).toBe("expired");
    expect(cred.accessTokenEncrypted).toBeUndefined();
    // Refresh token should still be present (needed for re-auth)
    expect(cred.refreshTokenEncrypted).toBe("v1:mock-iv:mock-tag:mock-refresh-ciphertext");
  });
});

// ── saveDriveDocumentInternal ────────────────────────────────────────
//
// NOTE: Full end-to-end coverage (document insertion, audit log, activity
// events, isReimport flag) is verified via importDriveFiles tests in
// google-drive-import.test.ts, which run saveDriveDocumentInternal inside
// an action context where convex-test storage upload interception works.
//
// The tests below cover validator enforcement only — storage upload via
// global fetch cannot reach the convex-test storage endpoint from outside
// the action VM, so we avoid that path here.

describe("credentials.saveDriveDocumentInternal", () => {
  test("throws when required args are missing (validator enforcement)", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(
        internalAny.googleDrive.credentials.saveDriveDocumentInternal,
        {}, // empty — validator must reject
      ),
    ).rejects.toThrow();
  });

  test("throws when category is an invalid enum value", async () => {
    const t = convexTest(schema, modules);
    const { userId, programId } = await seedGoogleDriveOrg(t);
    const credId = await seedActiveCredential(t, { userId, orgId: ORG_ID });

    await expect(
      t.mutation(internalAny.googleDrive.credentials.saveDriveDocumentInternal, {
        orgId: ORG_ID,
        programId,
        storageId: "invalid-storage-id",
        fileName: "test.pdf",
        fileType: "application/pdf",
        fileSize: 100,
        category: "not_a_valid_category", // invalid enum
        uploadedBy: userId,
        credentialId: credId,
        googleEmail: "gdrive@gmail.com",
        driveFileId: "drive-xyz",
        driveFileName: "Test.pdf",
        driveMimeType: "application/pdf",
        isReimport: false,
      }),
    ).rejects.toThrow();
  });
});

// ── generateStorageUploadUrlInternal ─────────────────────────────────

describe("credentials.generateStorageUploadUrlInternal", () => {
  test("returns a valid upload URL string", async () => {
    const t = convexTest(schema, modules);

    const url = await t.mutation(
      internalAny.googleDrive.credentials.generateStorageUploadUrlInternal,
      {},
    );

    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });
});
