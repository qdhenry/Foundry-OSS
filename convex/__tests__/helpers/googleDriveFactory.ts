/**
 * Shared factory helpers for Google Drive integration tests.
 * Follow the pattern from atlassian-integration.test.ts — direct t.run with ctx.db.insert.
 */

export const ORG_ID = "org-gdrive";
export const CLERK_USER_ID = "gdrive-user-1";

/**
 * Seeds a user + program for the Google Drive org.
 * Returns { userId, programId, orgId }
 */
export async function seedGoogleDriveOrg(t: any): Promise<{
  userId: any;
  programId: any;
  orgId: string;
}> {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: CLERK_USER_ID,
      email: "gdrive@example.com",
      name: "GDrive User",
      orgIds: [ORG_ID],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: ORG_ID,
      name: "GDrive Program",
      clientName: "GDrive Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "discovery",
      status: "active",
    });
  });

  return { userId, programId, orgId: ORG_ID };
}

/**
 * Seeds an active Google Drive credential for a user.
 * Returns credentialId.
 */
export async function seedActiveCredential(
  t: any,
  { userId, orgId }: { userId: any; orgId: string },
): Promise<any> {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("googleDriveCredentials", {
      orgId,
      userId,
      status: "active",
      accessTokenEncrypted: "v1:mock-iv:mock-tag:mock-ciphertext",
      refreshTokenEncrypted: "v1:mock-iv:mock-tag:mock-refresh-ciphertext",
      tokenExpiresAt: Date.now() + 3_600_000, // valid for 1 hour
      scopes: ["https://www.googleapis.com/auth/drive.readonly", "openid", "email"],
      googleEmail: "gdrive@gmail.com",
      googleUserId: "google-user-123",
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
    });
  });
}

/**
 * Seeds a document with a driveFileId so duplicate-check tests can find it.
 * Returns documentId.
 */
export async function seedDocumentForDuplicateCheck(
  t: any,
  {
    orgId,
    programId,
    userId,
    driveFileId,
  }: {
    orgId: string;
    programId: any;
    userId: any;
    driveFileId: string;
  },
): Promise<any> {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("documents", {
      orgId,
      programId,
      fileName: `${driveFileId}.pdf`,
      fileType: "application/pdf",
      fileSize: 1024,
      category: "other",
      uploadedBy: userId,
      source: "google_drive",
      driveFileId,
      driveFileName: `${driveFileId}.pdf`,
      driveMimeType: "application/pdf",
      analysisStatus: "none",
    });
  });
}
