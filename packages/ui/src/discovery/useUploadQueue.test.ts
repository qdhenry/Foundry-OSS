import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUploadQueue } from "./useUploadQueue";

// Mock requestAnimationFrame to be synchronous in tests
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
});
vi.stubGlobal("cancelAnimationFrame", vi.fn());

describe("useUploadQueue", () => {
  const defaultOptions = {
    orgId: "org-1",
    programId: "prog-1",
    maxConcurrent: 2,
    generateUploadUrl: vi.fn(async () => "https://upload.example.com/url"),
    saveDocument: vi.fn(async () => "doc-id-1"),
  };

  it("returns empty files array initially", () => {
    const { result } = renderHook(() => useUploadQueue(defaultOptions));
    expect(result.current.files).toEqual([]);
    expect(result.current.allDone).toBe(false);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.completedDocumentIds).toEqual([]);
  });

  it("addFiles queues files with detected categories", () => {
    const { result } = renderHook(() => useUploadQueue(defaultOptions));

    const file = new File(["test"], "requirements-doc.pdf", {
      type: "application/pdf",
    });
    const fileList = {
      length: 1,
      0: file,
      item: (i: number) => (i === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as unknown as FileList;

    act(() => {
      result.current.addFiles(fileList);
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].file.name).toBe("requirements-doc.pdf");
    expect(result.current.files[0].category).toBe("requirements");
  });

  it("updateCategory changes file category", () => {
    const { result } = renderHook(() => useUploadQueue(defaultOptions));

    const file = new File(["test"], "notes.txt", {
      type: "text/plain",
    });
    const fileList = {
      length: 1,
      0: file,
      item: (i: number) => (i === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as unknown as FileList;

    act(() => {
      result.current.addFiles(fileList);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateCategory(fileId, "architecture");
    });

    expect(result.current.files[0].category).toBe("architecture");
  });

  it("detects category from filename correctly", () => {
    const { result } = renderHook(() => useUploadQueue(defaultOptions));

    const files = [
      new File([""], "architecture-overview.pdf", { type: "application/pdf" }),
      new File([""], "meeting-notes-jan.docx", { type: "application/msword" }),
      new File([""], "test-plan.xlsx", { type: "application/vnd.ms-excel" }),
      new File([""], "deploy-guide.md", { type: "text/markdown" }),
      new File([""], "random-file.txt", { type: "text/plain" }),
    ];

    const fileList = {
      length: files.length,
      ...Object.fromEntries(files.map((f, i) => [i, f])),
      item: (i: number) => files[i] ?? null,
      [Symbol.iterator]: function* () {
        yield* files;
      },
    } as unknown as FileList;

    act(() => {
      result.current.addFiles(fileList);
    });

    expect(result.current.files).toHaveLength(5);
    expect(result.current.files[0].category).toBe("architecture");
    expect(result.current.files[1].category).toBe("meeting_notes");
    expect(result.current.files[2].category).toBe("testing");
    expect(result.current.files[3].category).toBe("deployment");
    expect(result.current.files[4].category).toBe("other");
  });
});
