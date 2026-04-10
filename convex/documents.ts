import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { resolveRetentionExpiresAt } from "./lib/videoRetention";
import { assertOrgAccess, getAuthUser } from "./model/access";
import { logAuditEvent } from "./model/audit";

const api: any = (generatedApi as any).api;
const internalApi: any = (generatedApi as any).internal;

const MAX_DOCUMENT_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB
const MAX_VIDEO_FILE_SIZE_BYTES = 1_024 * 1_024 * 1_024; // 1 GiB
const ALLOWED_DOCUMENT_TYPES = new Set(["pdf", "docx", "xlsx", "csv", "txt", "md"]);
const DOCUMENT_MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "application/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
};
type DocumentCategory =
  | "architecture"
  | "requirements"
  | "testing"
  | "deployment"
  | "meeting_notes"
  | "other";

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
]);

function inferDocumentType(fileName: string, fileType: string): string | null {
  const normalizedType = fileType.trim().toLowerCase();
  if (ALLOWED_DOCUMENT_TYPES.has(normalizedType)) {
    return normalizedType;
  }

  const mimeMatch = DOCUMENT_MIME_TYPE_TO_EXTENSION[normalizedType];
  if (mimeMatch) {
    return mimeMatch;
  }

  const extension = fileName.trim().toLowerCase().split(".").pop() ?? "";
  return ALLOWED_DOCUMENT_TYPES.has(extension) ? extension : null;
}

function assertValidDocumentUpload(fileName: string, fileType: string, fileSize: number) {
  const inferredType = inferDocumentType(fileName, fileType);
  if (!inferredType) {
    throw new ConvexError(
      `Unsupported document type. Allowed: ${Array.from(ALLOWED_DOCUMENT_TYPES).join(", ")}`,
    );
  }

  if (fileSize <= 0 || fileSize > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new ConvexError(
      `Document file size must be between 1 byte and ${MAX_DOCUMENT_FILE_SIZE_BYTES} bytes`,
    );
  }
}

function classifyDocumentCategory(fileName: string, contentSnippet?: string): DocumentCategory {
  const haystack = `${fileName} ${contentSnippet ?? ""}`.toLowerCase();

  if (
    /(architecture|system\s+design|technical\s+design|solution\s+design|data\s+model|erd|sequence\s+diagram)/.test(
      haystack,
    )
  ) {
    return "architecture";
  }
  if (
    /(requirement|business\s+requirement|functional\s+spec|gap\s+analysis|user\s+story|acceptance\s+criteria)/.test(
      haystack,
    )
  ) {
    return "requirements";
  }
  if (
    /(test\s+plan|test\s+case|qa\b|quality\s+assurance|uat|regression|validation)/.test(haystack)
  ) {
    return "testing";
  }
  if (/(deployment|release|cutover|go-live|runbook|rollback|migration\s+plan)/.test(haystack)) {
    return "deployment";
  }
  if (/(meeting|minutes|notes|workshop|discovery\s+call|standup|sync)/.test(haystack)) {
    return "meeting_notes";
  }

  return "other";
}

function assertValidVideoUpload(fileType: string, fileSize: number) {
  if (!ALLOWED_VIDEO_MIME_TYPES.has(fileType)) {
    throw new ConvexError(
      `Unsupported video mime type: ${fileType}. Allowed: ${Array.from(ALLOWED_VIDEO_MIME_TYPES).join(", ")}`,
    );
  }

  if (fileSize <= 0 || fileSize > MAX_VIDEO_FILE_SIZE_BYTES) {
    throw new ConvexError(
      `Video file size must be between 1 byte and ${MAX_VIDEO_FILE_SIZE_BYTES} bytes`,
    );
  }
}

function assertValidExternalObjectUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConvexError("externalObjectUrl must be a valid URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConvexError("externalObjectUrl must use http or https protocol");
  }
}

async function resolveDownloadUrl(ctx: any, doc: { storageId?: any; externalObjectUrl?: string }) {
  if (doc.storageId) {
    return await ctx.storage.getUrl(doc.storageId);
  }
  return doc.externalObjectUrl ?? null;
}

/** Generate a signed upload URL for document storage. */
export const generateUploadUrl = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getVideoUploadUrl = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    if (args.orgId !== program.orgId) {
      throw new ConvexError("orgId does not match program org");
    }

    assertValidVideoUpload(args.fileType, args.fileSize);

    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
    };
  },
});

/**
 * Save a document record after upload. Validates file type and size,
 * auto-classifies category, and triggers AI analysis.
 * @param orgId - Organization ID
 * @param programId - Parent program
 * @param storageId - Convex storage ID from the upload
 * @param fileName - Original file name
 * @param fileType - MIME type or file extension
 * @param fileSize - File size in bytes
 */
export const save = mutation({
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
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);
    assertValidDocumentUpload(args.fileName, args.fileType, args.fileSize);

    const user = await getAuthUser(ctx);

    const documentId = await ctx.db.insert("documents", {
      orgId: program.orgId,
      programId: args.programId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      category: args.category,
      description: args.description,
      uploadedBy: user._id,
    });

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "document",
      entityId: documentId as string,
      action: "create",
      description: `Uploaded document "${args.fileName}" (${args.category})`,
    });

    await ctx.db.insert("activityEvents", {
      orgId: program.orgId,
      programId: args.programId,
      page: "discovery",
      eventType: "document_uploaded",
      message: `Uploaded ${args.fileName}`,
      entityType: "document",
      entityId: documentId as string,
      userId: user._id,
      userName: user.name,
      createdAt: Date.now(),
    });

    return documentId;
  },
});

export const confirmVideoUpload = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    category: v.optional(
      v.union(
        v.literal("architecture"),
        v.literal("requirements"),
        v.literal("testing"),
        v.literal("deployment"),
        v.literal("meeting_notes"),
        v.literal("other"),
      ),
    ),
    description: v.optional(v.string()),
    externalObjectUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    videoDurationMs: v.optional(v.number()),
    retentionPolicy: v.optional(
      v.union(
        v.literal("30_days"),
        v.literal("60_days"),
        v.literal("90_days"),
        v.literal("180_days"),
        v.literal("indefinite"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    if (args.orgId !== program.orgId) {
      throw new ConvexError("orgId does not match program org");
    }

    assertValidVideoUpload(args.fileType, args.fileSize);

    if (!args.externalObjectUrl && !args.storageId) {
      throw new ConvexError("Either externalObjectUrl or storageId is required");
    }
    if (args.externalObjectUrl) {
      assertValidExternalObjectUrl(args.externalObjectUrl);
    }

    let resolvedExternalObjectUrl = args.externalObjectUrl;
    if (!resolvedExternalObjectUrl && args.storageId) {
      const uploadedUrl = await ctx.storage.getUrl(args.storageId as Id<"_storage">);
      if (!uploadedUrl) {
        throw new ConvexError("Unable to resolve uploaded storage URL");
      }
      resolvedExternalObjectUrl = uploadedUrl;
    }
    if (!resolvedExternalObjectUrl) {
      throw new ConvexError("Unable to resolve video object URL");
    }

    const user = await getAuthUser(ctx);

    const documentId = await ctx.db.insert("documents", {
      orgId: program.orgId,
      programId: args.programId,
      storageId: args.storageId,
      externalObjectUrl: resolvedExternalObjectUrl,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      category: args.category ?? "meeting_notes",
      description: args.description,
      uploadedBy: user._id,
      analysisStatus: "queued",
    });

    const retentionPolicy = args.retentionPolicy ?? "90_days";
    const videoAnalysisId = await ctx.db.insert("videoAnalyses", {
      orgId: program.orgId,
      programId: args.programId,
      documentId,
      status: "uploading",
      videoUrl: resolvedExternalObjectUrl,
      videoSizeBytes: args.fileSize,
      videoDurationMs: args.videoDurationMs,
      mimeType: args.fileType,
      speakerMappingComplete: true,
      retentionPolicy,
      retentionExpiresAt: resolveRetentionExpiresAt(retentionPolicy),
      retentionStatus: "active",
      analysisVersion: 1,
      retryCount: 0,
      stageTimestamps: { uploadingAt: Date.now() },
    });

    await ctx.scheduler.runAfter(0, internalApi.videoAnalysisActionsTL.submitToTwelveLabs, {
      analysisId: videoAnalysisId,
    });

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "document",
      entityId: documentId as string,
      action: "create",
      description: `Confirmed video upload "${args.fileName}"`,
      metadata: {
        uploadType: "external_video",
        externalObjectUrl: resolvedExternalObjectUrl,
        videoAnalysisId,
      },
    });

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "video_analysis",
      entityId: videoAnalysisId as string,
      action: "create",
      description: `Created video analysis bootstrap for "${args.fileName}"`,
      metadata: { documentId, status: "uploading" },
    });

    return { documentId, videoAnalysisId };
  },
});

/**
 * List documents for a program with optional category and source filters.
 * Returns enriched records with download URLs and uploader names.
 * @param programId - The program to query
 */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    category: v.optional(
      v.union(
        v.literal("architecture"),
        v.literal("requirements"),
        v.literal("testing"),
        v.literal("deployment"),
        v.literal("meeting_notes"),
        v.literal("other"),
      ),
    ),
    source: v.optional(v.union(v.literal("upload"), v.literal("google_drive"))),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    let filtered = args.category
      ? documents.filter((d) => d.category === args.category)
      : documents;

    if (args.source !== undefined) {
      filtered = filtered.filter((d) => (d.source ?? "upload") === args.source);
    }

    return await Promise.all(
      filtered.map(async (doc) => {
        const uploader = await ctx.db.get(doc.uploadedBy);
        return {
          ...doc,
          uploaderName: uploader?.name ?? "Unknown",
          downloadUrl: await resolveDownloadUrl(ctx, doc),
        };
      }),
    );
  },
});

/** Retrieve a single document by ID with download URL and uploader name. */
export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertOrgAccess(ctx, doc.orgId);

    const uploader = await ctx.db.get(doc.uploadedBy);
    const downloadUrl = await resolveDownloadUrl(ctx, doc);

    return {
      ...doc,
      uploaderName: uploader?.name ?? "Unknown",
      downloadUrl,
    };
  },
});

/**
 * Update document metadata (category, description).
 * @param documentId - The document to update
 */
export const update = mutation({
  args: {
    documentId: v.id("documents"),
    category: v.optional(
      v.union(
        v.literal("architecture"),
        v.literal("requirements"),
        v.literal("testing"),
        v.literal("deployment"),
        v.literal("meeting_notes"),
        v.literal("other"),
      ),
    ),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertOrgAccess(ctx, doc.orgId);
    const user = await getAuthUser(ctx);

    const updates: Record<string, unknown> = {};
    if (args.category !== undefined) updates.category = args.category;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.documentId, updates);

    await logAuditEvent(ctx, {
      orgId: doc.orgId,
      programId: doc.programId as string,
      entityType: "document",
      entityId: args.documentId as string,
      action: "update",
      description: `Updated document "${doc.fileName}"`,
    });

    await ctx.db.insert("activityEvents", {
      orgId: doc.orgId,
      programId: doc.programId,
      page: "discovery",
      eventType: "document_updated",
      message: `Updated ${doc.fileName}`,
      entityType: "document",
      entityId: args.documentId as string,
      userId: user._id,
      userName: user.name,
      createdAt: Date.now(),
    });
  },
});

type CategorizeResult = {
  documentId: Id<"documents">;
  previousCategory: DocumentCategory;
  category: DocumentCategory;
  updated: boolean;
  usedContentSnippet: boolean;
};

const categorizeHandler = async (
  ctx: any,
  args: { documentId: Id<"documents"> },
): Promise<CategorizeResult> => {
  const analysis: any = await ctx.runQuery(api.documentAnalysis.getByDocument, {
    documentId: args.documentId,
  });
  const document: any = await ctx.runQuery(internalApi.documents.getById, {
    documentId: args.documentId,
  });
  if (!document) throw new ConvexError("Document not found");

  let contentSnippet: string | undefined =
    typeof document.description === "string" ? document.description : undefined;

  if (!contentSnippet) {
    if (analysis?.extractedText && typeof analysis.extractedText === "string") {
      contentSnippet = analysis.extractedText.slice(0, 2000);
    } else if (analysis?.findings && typeof analysis.findings === "object") {
      const findings = analysis.findings as Record<string, unknown>;
      if (typeof findings.summary === "string") {
        contentSnippet = findings.summary;
      }
    }
  }

  const category = classifyDocumentCategory(document.fileName, contentSnippet);
  const updated = document.category !== category;
  if (updated) {
    await ctx.runMutation(internalApi.documents.updateCategoryInternal, {
      documentId: args.documentId,
      category,
    });
  }

  return {
    documentId: args.documentId,
    previousCategory: document.category as DocumentCategory,
    category,
    updated,
    usedContentSnippet: Boolean(contentSnippet),
  };
};

export const categorize = action({
  args: { documentId: v.id("documents") },
  handler: categorizeHandler,
});

export const updateCategoryInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    category: v.union(
      v.literal("architecture"),
      v.literal("requirements"),
      v.literal("testing"),
      v.literal("deployment"),
      v.literal("meeting_notes"),
      v.literal("other"),
    ),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ConvexError("Document not found");
    await assertOrgAccess(ctx, doc.orgId);

    await ctx.db.patch(args.documentId, { category: args.category });

    await logAuditEvent(ctx, {
      orgId: doc.orgId,
      programId: doc.programId as string,
      entityType: "document",
      entityId: args.documentId as string,
      action: "update",
      description: `Auto-categorized document "${doc.fileName}" as ${args.category}`,
      metadata: {
        autoCategorized: true,
      },
    });
  },
});

/** Delete a document and its backing storage file. */
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertOrgAccess(ctx, doc.orgId);
    const user = await getAuthUser(ctx);

    if (doc.storageId) {
      await ctx.storage.delete(doc.storageId);
    }
    await ctx.db.delete(args.documentId);

    await logAuditEvent(ctx, {
      orgId: doc.orgId,
      programId: doc.programId as string,
      entityType: "document",
      entityId: args.documentId as string,
      action: "delete",
      description: `Deleted document "${doc.fileName}"`,
    });

    await ctx.db.insert("activityEvents", {
      orgId: doc.orgId,
      programId: doc.programId,
      page: "discovery",
      eventType: "document_deleted",
      message: `Deleted ${doc.fileName}`,
      entityType: "document",
      entityId: args.documentId as string,
      userId: user._id,
      userName: user.name,
      createdAt: Date.now(),
    });
  },
});

// Internal query for agent context — get document by ID without auth
export const getById = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

// Duplicate detection — find an existing document imported from a given Drive file
// Used before import to warn the user if the file was previously imported.
// Returns the most recent document with a matching driveFileId within the org.
export const findByDriveFileId = query({
  args: {
    orgId: v.string(),
    driveFileId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_org_drive_file", (q) =>
        q.eq("orgId", args.orgId).eq("driveFileId", args.driveFileId),
      )
      .collect();

    if (docs.length === 0) return null;

    // Return the most recently added one
    docs.sort((a, b) => b._creationTime - a._creationTime);
    return docs[0];
  },
});
