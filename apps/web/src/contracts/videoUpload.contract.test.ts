import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOCUMENTS_PATH = path.resolve(process.cwd(), "convex/documents.ts");

function readDocumentsSource(): string {
  return readFileSync(DOCUMENTS_PATH, "utf8");
}

describe("video upload PR2 contract", () => {
  it("exports video upload mutations with upload-url + confirmation contract", () => {
    const source = readDocumentsSource();

    expect(source).toMatch(/export const getVideoUploadUrl = mutation\(\{/);
    expect(source).toMatch(/getVideoUploadUrl[\s\S]*ctx\.storage\.generateUploadUrl\(\)/);
    expect(source).toMatch(/export const confirmVideoUpload = mutation\(\{/);
    expect(source).toMatch(
      /confirmVideoUpload[\s\S]*externalObjectUrl:\s*v\.optional\(v\.string\(\)\)/,
    );
    expect(source).toMatch(
      /confirmVideoUpload[\s\S]*storageId:\s*v\.optional\(v\.id\("_storage"\)\)/,
    );
    expect(source).toMatch(/Either externalObjectUrl or storageId is required/);
  });

  it("creates linked video analysis bootstrap on confirm", () => {
    const source = readDocumentsSource();

    expect(source).toMatch(/ctx\.db\.insert\("documents"/);
    expect(source).toMatch(/ctx\.db\.insert\("videoAnalyses"/);
    expect(source).toMatch(/return\s*\{\s*documentId,\s*videoAnalysisId\s*\}/);
  });

  it("validates video mime and size constraints", () => {
    const source = readDocumentsSource();

    expect(source).toMatch(/ALLOWED_VIDEO_MIME_TYPES/);
    expect(source).toMatch(/MAX_VIDEO_FILE_SIZE_BYTES/);
    expect(source).toMatch(/assertValidVideoUpload/);
  });
});
