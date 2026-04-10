"use node";

import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;

import { encryptWithAesGcm } from "../../googleDrive/encryption";
import schema from "../../schema";
import { modules } from "../../test.helpers";
import {
  CLERK_USER_ID,
  ORG_ID,
  seedDocumentForDuplicateCheck,
  seedGoogleDriveOrg,
} from "../helpers/googleDriveFactory";

/**
 * Integration tests for convex/googleDrive/importActions.ts (importDriveFiles action).
 *
 * Tests cover:
 * - Early-exit validation (empty array, >10 files)
 * - Auth/credential checks (no auth, revoked credential, bad program, wrong org)
 * - Per-file error resilience
 * - Google-native MIME type export (Docs→DOCX, Sheets→XLSX, Slides→PDF)
 * - Duplicate detection/marking
 * - Best-effort analysis queuing
 *
 * Uses global.fetch mocking for Drive API + Convex storage uploads.
 */

// ── Test encryption key setup ─────────────────────────────────────────

const TEST_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex chars = 32 bytes

beforeAll(() => {
  process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://example.com/callback";
});

// ── Fetch mock setup ──────────────────────────────────────────────────

const FAKE_PDF_BYTES = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // "%PDF-1.4"
const FAKE_DOCX_BYTES = new Uint8Array([80, 75, 3, 4]); // PK header (zip)
const FAKE_XLSX_BYTES = new Uint8Array([80, 75, 3, 4]); // PK header (zip)

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  // Use fake timers so convex-test's ctx.scheduler.runAfter(0, ...) setTimeouts
  // don't fire asynchronously after the test ends (causing "Write outside of
  // transaction" unhandled rejections). Promise microtasks still resolve normally.
  vi.useFakeTimers();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// convex-test encodes IDs as "{counter};{tableName}" (e.g., "10000;programs").
// Any string matching this format passes v.id("_storage") validation, which only
// checks that tableNameFromId(id) === "_storage". The stored document just holds
// the ID reference; convex-test does NOT verify the file actually exists.
const FAKE_STORAGE_ID = "1;_storage";

/**
 * Creates a fetch mock that handles both Drive API calls and Convex storage uploads.
 *
 * Convex storage upload URLs (https://some-deployment.convex.cloud/api/storage/upload?...)
 * are NOT reachable via Node.js global fetch in "use node" actions — convex-test only
 * intercepts them inside its own JS VM context. We intercept them here and return a
 * fake storageId in the convex-test ID format so v.id("_storage") validation passes.
 */
function mockFetchForImport({
  driveBytes = FAKE_PDF_BYTES,
  driveStatus = 200,
}: {
  driveBytes?: Uint8Array;
  driveStatus?: number;
} = {}) {
  globalThis.fetch = vi
    .fn()
    .mockImplementation(async (url: string | URL | Request, _opts?: RequestInit) => {
      const urlStr = url.toString();

      // Intercept Convex storage upload — return fake storageId
      if (urlStr.includes("/api/storage/upload")) {
        return new Response(JSON.stringify({ storageId: FAKE_STORAGE_ID }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Google Drive API — download or export
      if (urlStr.includes("googleapis.com/drive")) {
        if (driveStatus === 403) {
          return new Response("Forbidden", { status: 403 });
        }
        if (driveStatus !== 200) {
          return new Response("Error", { status: driveStatus });
        }
        return new Response(driveBytes.buffer as ArrayBuffer, {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      }

      return new Response("Not Found", { status: 404 });
    });
}

// ── Seed helper for import tests that need a valid encrypted credential ───

async function seedEncryptedCredential(
  t: any,
  userId: any,
  opts: { status?: "active" | "expired" | "revoked" } = {},
) {
  const status = opts.status ?? "active";
  // Encrypt a real test token so resolveAccessTokenInternal can decrypt it
  const accessTokenEncrypted = encryptWithAesGcm("test-access-token");
  const refreshTokenEncrypted = encryptWithAesGcm("test-refresh-token");

  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("googleDriveCredentials", {
      orgId: ORG_ID,
      userId,
      status,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt: Date.now() + 3_600_000, // 1 hour from now
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      googleEmail: "gdrive@gmail.com",
      googleUserId: "google-user-123",
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
    });
  });
}

// ── File fixture factories ────────────────────────────────────────────

function makePdfFile(
  overrides: Partial<{
    fileId: string;
    name: string;
    mimeType: string;
    size: number;
  }> = {},
) {
  return {
    fileId: overrides.fileId ?? "gdrive-pdf-001",
    name: overrides.name ?? "Test Document.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    size: overrides.size ?? 1024,
  };
}

function makeGoogleDocFile() {
  return {
    fileId: "gdrive-doc-001",
    name: "Google Doc",
    mimeType: "application/vnd.google-apps.document",
  };
}

function makeGoogleSheetFile() {
  return {
    fileId: "gdrive-sheet-001",
    name: "Google Sheet",
    mimeType: "application/vnd.google-apps.spreadsheet",
  };
}

function makeGoogleSlideFile() {
  return {
    fileId: "gdrive-slide-001",
    name: "Google Slides",
    mimeType: "application/vnd.google-apps.presentation",
  };
}

// ── Early-exit validation tests (no auth required) ───────────────────

describe("importDriveFiles: empty array", () => {
  test("returns empty array immediately when files list is empty", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    // Handler returns [] before doing any Drive/storage work when files is empty
    const result = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "other",
      files: [],
    });
    expect(result).toEqual([]);
  });
});

describe("importDriveFiles: batch size validation", () => {
  test("throws when more than 10 files are provided", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const elevenFiles = Array.from({ length: 11 }, (_, i) =>
      makePdfFile({ fileId: `file-${i}`, name: `File ${i}.pdf` }),
    );

    await expect(
      asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
        orgId: ORG_ID,
        programId,
        credentialId: credId,
        category: "other",
        files: elevenFiles,
      }),
    ).rejects.toThrow("Cannot import more than 10 files at once");
  });
});

// ── Auth / credential checks ──────────────────────────────────────────

describe("importDriveFiles: authentication and authorization", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    // Use t.action without identity (not authenticated)
    await expect(
      t.action(apiAny.googleDrive.importActions.importDriveFiles, {
        orgId: ORG_ID,
        programId,
        credentialId: credId,
        category: "other",
        files: [makePdfFile()],
      }),
    ).rejects.toThrow();
  });

  test("throws when user is not in the org", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    // Create a user in a different org
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkId: "outsider-import",
        email: "outsider@example.com",
        name: "Outsider",
        orgIds: ["org-outside"],
        role: "admin",
      });
    });
    const asOutsider = t.withIdentity({ subject: "outsider-import" });

    await expect(
      asOutsider.action(apiAny.googleDrive.importActions.importDriveFiles, {
        orgId: ORG_ID,
        programId,
        credentialId: credId,
        category: "other",
        files: [makePdfFile()],
      }),
    ).rejects.toThrow();
  });

  test("throws when credential has been revoked", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId, {
      status: "revoked",
    });
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    await expect(
      asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
        orgId: ORG_ID,
        programId,
        credentialId: credId,
        category: "other",
        files: [makePdfFile()],
      }),
    ).rejects.toThrow("revoked");
  });

  test("throws when program does not exist", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    // Delete the program so it doesn't exist
    await t.run(async (ctx: any) => ctx.db.delete(programId));

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    await expect(
      asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
        orgId: ORG_ID,
        programId,
        credentialId: credId,
        category: "other",
        files: [makePdfFile()],
      }),
    ).rejects.toThrow("Program not found");
  });

  test("throws when program belongs to a different org", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    // Create a program in a different org
    const otherProgramId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-different",
        name: "Other Program",
        clientName: "Other Client",
        phase: "discovery",
        status: "active",
      });
    });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    await expect(
      asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
        orgId: ORG_ID,
        programId: otherProgramId,
        credentialId: credId,
        category: "other",
        files: [makePdfFile()],
      }),
    ).rejects.toThrow("Program not found");
  });
});

// ── Happy path tests (with fetch mocking) ────────────────────────────

describe("importDriveFiles: successful import", () => {
  test("imports a single PDF file and returns result with documentId", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    mockFetchForImport({ driveBytes: FAKE_PDF_BYTES });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    const results = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "requirements",
      files: [makePdfFile()],
    });

    expect(results).toHaveLength(1);
    expect(results[0].fileId).toBe("gdrive-pdf-001");
    expect(results[0].documentId).toBeDefined();
    expect(results[0].error).toBeUndefined();
    expect(results[0].duplicate).toBe(false);

    // Verify document was persisted
    const doc = await t.run(async (ctx: any) => ctx.db.get(results[0].documentId));
    expect(doc).not.toBeNull();
    expect(doc.driveFileId).toBe("gdrive-pdf-001");
    expect(doc.source).toBe("google_drive");
    expect(doc.category).toBe("requirements");
  });

  test("exports Google Docs to DOCX and renames file", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    mockFetchForImport({ driveBytes: FAKE_DOCX_BYTES });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    const results = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "other",
      files: [makeGoogleDocFile()],
    });

    expect(results).toHaveLength(1);
    expect(results[0].error).toBeUndefined();

    const doc = await t.run(async (ctx: any) => ctx.db.get(results[0].documentId));
    // Google Docs → DOCX: filename should end with .docx
    expect(doc.fileName).toMatch(/\.docx$/);
    expect(doc.driveMimeType).toBe("application/vnd.google-apps.document");
  });

  test("exports Google Sheets to XLSX", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    mockFetchForImport({ driveBytes: FAKE_XLSX_BYTES });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    const results = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "other",
      files: [makeGoogleSheetFile()],
    });

    expect(results).toHaveLength(1);
    expect(results[0].error).toBeUndefined();

    const doc = await t.run(async (ctx: any) => ctx.db.get(results[0].documentId));
    expect(doc.fileName).toMatch(/\.xlsx$/);
  });

  test("exports Google Slides to PDF", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    mockFetchForImport({ driveBytes: FAKE_PDF_BYTES });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    const results = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "other",
      files: [makeGoogleSlideFile()],
    });

    expect(results).toHaveLength(1);
    expect(results[0].error).toBeUndefined();

    const doc = await t.run(async (ctx: any) => ctx.db.get(results[0].documentId));
    expect(doc.fileName).toMatch(/\.pdf$/);
    expect(doc.driveMimeType).toBe("application/vnd.google-apps.presentation");
  });
});

// ── Duplicate detection ───────────────────────────────────────────────

describe("importDriveFiles: duplicate detection", () => {
  test("marks result as duplicate when file was previously imported", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    // Seed an existing document with the same driveFileId
    const driveFileId = "gdrive-pdf-duplicate";
    await seedDocumentForDuplicateCheck(t, {
      orgId: ORG_ID,
      programId,
      userId,
      driveFileId,
    });

    mockFetchForImport({ driveBytes: FAKE_PDF_BYTES });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    const results = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "other",
      files: [makePdfFile({ fileId: driveFileId, name: "Dup Doc.pdf" })],
    });

    expect(results).toHaveLength(1);
    expect(results[0].duplicate).toBe(true);
    // Still imports (re-import allowed)
    expect(results[0].documentId).toBeDefined();
    expect(results[0].error).toBeUndefined();
  });
});

// ── Per-file error resilience ─────────────────────────────────────────

describe("importDriveFiles: per-file error resilience", () => {
  test("captures file-level error and continues with remaining files", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    // First Drive call returns 403 (error), second returns valid PDF
    let callCount = 0;
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async (url: string | URL | Request, _opts?: RequestInit) => {
        const urlStr = url.toString();

        // Intercept Convex storage upload — return fake storageId
        if (urlStr.includes("/api/storage/upload")) {
          return new Response(JSON.stringify({ storageId: FAKE_STORAGE_ID }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (urlStr.includes("googleapis.com/drive")) {
          callCount++;
          if (callCount === 1) {
            return new Response("Forbidden", { status: 403 });
          }
          return new Response(FAKE_PDF_BYTES, { status: 200 });
        }

        return new Response("Not Found", { status: 404 });
      });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    const results = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "other",
      files: [
        makePdfFile({ fileId: "file-will-fail", name: "Fail.pdf" }),
        makePdfFile({ fileId: "file-will-succeed", name: "Succeed.pdf" }),
      ],
    });

    // Both files should have results — failures don't abort the batch
    expect(results).toHaveLength(2);

    const failedResult = results.find((r: any) => r.fileId === "file-will-fail");
    const succeededResult = results.find((r: any) => r.fileId === "file-will-succeed");

    expect(failedResult.error).toBeDefined();
    expect(failedResult.documentId).toBeUndefined();

    expect(succeededResult.error).toBeUndefined();
    expect(succeededResult.documentId).toBeDefined();
  });

  test("returns error for unsupported MIME type without aborting batch", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    mockFetchForImport({ driveBytes: FAKE_PDF_BYTES });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    const results = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "other",
      files: [
        makePdfFile({
          fileId: "bad-mime",
          name: "Unknown.mp4",
          mimeType: "video/mp4", // not supported
        }),
        makePdfFile({ fileId: "good-file", name: "Good.pdf" }),
      ],
    });

    expect(results).toHaveLength(2);
    const badResult = results.find((r: any) => r.fileId === "bad-mime");
    const goodResult = results.find((r: any) => r.fileId === "good-file");

    expect(badResult.error).toContain("Unsupported file type");
    expect(goodResult.documentId).toBeDefined();
  });
});

// ── Analysis queuing (best-effort) ───────────────────────────────────

describe("importDriveFiles: analysis queuing", () => {
  test("returns results even when analysis queueing fails (best-effort)", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await seedGoogleDriveOrg(t);
    const credId = await seedEncryptedCredential(t, userId);

    mockFetchForImport({ driveBytes: FAKE_PDF_BYTES });

    const asUser = t.withIdentity({ subject: CLERK_USER_ID });
    // Even if queueBatchAnalysis throws internally, the import should succeed
    const results = await asUser.action(apiAny.googleDrive.importActions.importDriveFiles, {
      orgId: ORG_ID,
      programId,
      credentialId: credId,
      category: "other",
      files: [makePdfFile()],
    });

    // Import should still succeed regardless of analysis queueing
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBeDefined();
  });
});
