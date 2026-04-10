"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "../_generated/api";
import { action } from "../_generated/server";
import { authorizeCredentialOwner } from "./auth";

const api: any = (generatedApi as any).api;
const internalApi: any = (generatedApi as any).internal;

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB
const MAX_FILES_PER_BATCH = 10;

// Google-native MIME types that require Drive export
const GOOGLE_NATIVE_EXPORT: Record<string, { exportMimeType: string; extension: string }> = {
  "application/vnd.google-apps.document": {
    exportMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    exportMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    exportMimeType: "application/pdf",
    extension: "pdf",
  },
};

// Supported regular MIME types for direct download
const REGULAR_MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "application/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
};

async function downloadDriveFile(
  accessToken: string,
  fileId: string,
  mimeType: string,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const googleNative = GOOGLE_NATIVE_EXPORT[mimeType];

  let url: string;
  let contentType: string;

  if (googleNative) {
    // Export Google-native format (Docs→DOCX, Sheets→XLSX, Slides→PDF)
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(googleNative.exportMimeType)}`;
    contentType = googleNative.exportMimeType;
  } else if (REGULAR_MIME_TO_EXTENSION[mimeType]) {
    // Direct binary download for supported formats
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    contentType = mimeType;
  } else {
    throw new ConvexError(
      `Unsupported file type: ${mimeType}. Supported: PDF, DOCX, XLSX, CSV, TXT, MD, Google Docs/Sheets/Slides.`,
    );
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status === 403) {
    throw new ConvexError("Access denied — file may have been moved or unshared");
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new ConvexError(`Drive download failed (${resp.status}): ${text}`);
  }

  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    const mb = Math.round(buffer.byteLength / 1024 / 1024);
    throw new ConvexError(`File exceeds 50MB limit (${mb}MB)`);
  }

  return { buffer, contentType };
}

/**
 * Imports a batch of Google Drive files into a Foundry program.
 * Called from the frontend after the user selects files in Google Picker.
 *
 * After all files are stored, automatically queues document analysis.
 * Sandwich pattern: auth (via credential) → Drive API → Convex mutations.
 */
export const importDriveFiles = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    credentialId: v.id("googleDriveCredentials"),
    category: v.union(
      v.literal("architecture"),
      v.literal("requirements"),
      v.literal("testing"),
      v.literal("deployment"),
      v.literal("meeting_notes"),
      v.literal("other"),
    ),
    files: v.array(
      v.object({
        fileId: v.string(),
        name: v.string(),
        mimeType: v.string(),
        modifiedTime: v.optional(v.string()),
        webViewLink: v.optional(v.string()),
        version: v.optional(v.string()),
        size: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.files.length === 0) return [];
    if (args.files.length > MAX_FILES_PER_BATCH) {
      throw new ConvexError(`Cannot import more than ${MAX_FILES_PER_BATCH} files at once`);
    }

    const { credential } = await authorizeCredentialOwner(ctx, {
      orgId: args.orgId,
      credentialId: args.credentialId,
    });
    if (credential.status === "revoked") {
      throw new ConvexError("Google Drive connection has been revoked — please reconnect");
    }

    // Fetch program for targetPlatform (needed by analysis pipeline)
    const program = await ctx.runQuery(internalApi.programs.getByIdInternal, {
      programId: args.programId,
    });
    if (!program || program.orgId !== args.orgId) {
      throw new ConvexError("Program not found");
    }
    const targetPlatform: string = program.targetPlatform ?? "none";

    // Resolve a valid (possibly refreshed) access token
    const accessToken: string = await ctx.runAction(
      internalApi.googleDrive.credentials.resolveAccessTokenInternal,
      { credentialId: args.credentialId },
    );

    // Process each file independently — failures don't abort the batch
    const results: Array<{
      fileId: string;
      documentId?: string;
      duplicate?: boolean;
      error?: string;
    }> = [];
    const succeededDocumentIds: string[] = [];

    for (const file of args.files) {
      let documentId: string | undefined;
      let duplicate = false;
      let error: string | undefined;

      try {
        // Duplicate check — warn but still allow re-import
        const existing = await ctx.runQuery(
          internalApi.googleDrive.credentials.checkDuplicateDriveFileInternal,
          { programId: args.programId, driveFileId: file.fileId },
        );
        duplicate = !!existing;

        // Download or export from Drive
        const { buffer, contentType } = await downloadDriveFile(
          accessToken,
          file.fileId,
          file.mimeType,
        );

        // Get Convex storage upload URL
        const uploadUrl: string = await ctx.runMutation(
          internalApi.googleDrive.credentials.generateStorageUploadUrlInternal,
          {},
        );

        // Upload binary to Convex file storage
        const uploadResp = await fetch(uploadUrl, {
          method: "POST",
          body: buffer,
          headers: { "Content-Type": contentType },
        });
        if (!uploadResp.ok) {
          throw new ConvexError(`Storage upload failed (${uploadResp.status})`);
        }
        const { storageId } = (await uploadResp.json()) as {
          storageId: string;
        };

        // Build target filename with correct extension for exported formats
        const googleNative = GOOGLE_NATIVE_EXPORT[file.mimeType];
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const fileName = googleNative ? `${baseName}.${googleNative.extension}` : file.name;

        // Persist document record + audit log (google_drive_import or reimport)
        documentId = (await ctx.runMutation(
          internalApi.googleDrive.credentials.saveDriveDocumentInternal,
          {
            orgId: args.orgId,
            programId: args.programId,
            storageId,
            fileName,
            fileType: contentType,
            fileSize: buffer.byteLength,
            category: args.category,
            uploadedBy: credential.userId,
            credentialId: args.credentialId,
            googleEmail: credential.googleEmail,
            driveFileId: file.fileId,
            driveFileName: file.name,
            driveMimeType: file.mimeType,
            driveWebViewLink: file.webViewLink,
            driveModifiedTime: file.modifiedTime,
            driveVersion: file.version,
            isReimport: duplicate,
          },
        )) as string;

        succeededDocumentIds.push(documentId);
      } catch (err) {
        error = err instanceof Error ? err.message : "Unknown error";
      }

      results.push({ fileId: file.fileId, documentId, duplicate, error });
    }

    // Queue document analysis for all successfully imported files
    if (succeededDocumentIds.length > 0) {
      try {
        await ctx.runAction(api.documentAnalysisActions.queueBatchAnalysis, {
          orgId: args.orgId,
          programId: args.programId as string,
          documentIds: succeededDocumentIds,
          targetPlatform,
        });
      } catch {
        // Analysis queueing is best-effort — storage already succeeded.
        // Frontend can retry analysis independently.
      }
    }

    return results;
  },
});
