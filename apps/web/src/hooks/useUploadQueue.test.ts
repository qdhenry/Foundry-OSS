import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FileCategory, useUploadQueue } from "./useUploadQueue";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFile(name: string, size = 1024, type = "application/pdf"): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

function createMockFileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const f of files) yield f;
    },
  } as unknown as FileList;
  // Index access support (e.g. fileList[0])
  for (let i = 0; i < files.length; i++) {
    (list as Record<number, File>)[i] = files[i];
  }
  return list;
}

function defaultOptions(overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org_test",
    programId: "prog_test",
    generateUploadUrl: vi.fn().mockResolvedValue("https://upload.test/url"),
    saveDocument: vi.fn().mockResolvedValue("doc_123"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// XHR mock factory
// ---------------------------------------------------------------------------

interface MockXHR {
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  upload: { onprogress: ((e: Partial<ProgressEvent>) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  status: number;
  responseText: string;
}

let mockXHRInstances: MockXHR[] = [];

function installXHRMock(options?: { failOnSend?: boolean }) {
  mockXHRInstances = [];
  // Must use function keyword (not arrow) so `new XMLHttpRequest()` works in vitest v4
  function MockXHRClass(this: MockXHR) {
    this.open = vi.fn();
    this.setRequestHeader = vi.fn();
    this.abort = vi.fn();
    this.upload = { onprogress: null };
    this.onload = null;
    this.onerror = null;
    this.status = 200;
    this.responseText = JSON.stringify({ storageId: "storage_123" });

    this.send = vi.fn().mockImplementation(() => {
      if (options?.failOnSend) {
        setTimeout(() => this.onerror?.(), 0);
      } else {
        // Simulate progress then success
        setTimeout(() => {
          this.upload.onprogress?.({
            lengthComputable: true,
            loaded: 512,
            total: 1024,
          });
        }, 0);
        setTimeout(() => {
          this.upload.onprogress?.({
            lengthComputable: true,
            loaded: 1024,
            total: 1024,
          });
          this.status = 200;
          this.responseText = JSON.stringify({
            storageId: "storage_123",
          });
          this.onload?.();
        }, 5);
      }
    });
    mockXHRInstances.push(this);
  }
  vi.stubGlobal("XMLHttpRequest", MockXHRClass);
  return MockXHRClass;
}

// ---------------------------------------------------------------------------
// Mock requestAnimationFrame for synchronous sync()
// ---------------------------------------------------------------------------

beforeEach(() => {
  // The mock must return a handle BEFORE invoking the callback, so that
  // `rafRef.current = requestAnimationFrame(cb)` assigns the handle first,
  // and then `cb` can set `rafRef.current = null` without being overwritten.
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      queueMicrotask(() => cb(0));
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockXHRInstances = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useUploadQueue", () => {
  // 1. addFiles adds files with queued status
  it("addFiles adds files with queued status and auto-detected categories", async () => {
    // Prevent uploads from actually starting so we can inspect queued state
    const opts = defaultOptions({
      maxConcurrent: 0,
      generateUploadUrl: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([
      createMockFile("gap-analysis.pdf"),
      createMockFile("architecture-diagram.png", 2048, "image/png"),
      createMockFile("random-doc.txt", 512, "text/plain"),
    ]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.files).toHaveLength(3);
    });

    expect(result.current.files[0].status).toBe("queued");
    expect(result.current.files[0].category).toBe("requirements");
    expect(result.current.files[1].status).toBe("queued");
    expect(result.current.files[1].category).toBe("architecture");
    expect(result.current.files[2].status).toBe("queued");
    expect(result.current.files[2].category).toBe("other");
  });

  // 2. respects maxConcurrent limit
  it("respects maxConcurrent limit", async () => {
    // generateUploadUrl never resolves so files stay in getting_url
    const generateUploadUrl = vi.fn().mockReturnValue(new Promise(() => {}));
    const opts = defaultOptions({ maxConcurrent: 2, generateUploadUrl });

    const { result } = renderHook(() => useUploadQueue(opts));

    const files = Array.from({ length: 5 }, (_, i) => createMockFile(`file-${i}.pdf`));
    const fileList = createMockFileList(files);

    act(() => {
      result.current.addFiles(fileList);
    });

    // Wait for state to settle
    await waitFor(() => {
      const statuses = result.current.files.map((f) => f.status);
      const activeCount = statuses.filter((s) => s === "getting_url").length;
      const queuedCount = statuses.filter((s) => s === "queued").length;
      expect(activeCount).toBe(2);
      expect(queuedCount).toBe(3);
    });
  });

  // 3. full upload pipeline reaches done
  it("full upload pipeline reaches done with documentId", async () => {
    installXHRMock();

    const saveDocument = vi.fn().mockResolvedValue("doc_456");
    const opts = defaultOptions({ maxConcurrent: 1, saveDocument });

    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([createMockFile("test-file.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.files[0]?.status).toBe("done");
    });

    expect(result.current.files[0].documentId).toBe("doc_456");
    expect(result.current.files[0].progress).toBe(100);
    expect(saveDocument).toHaveBeenCalledOnce();
    expect(saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_test",
        programId: "prog_test",
        storageId: "storage_123",
        fileName: "test-file.pdf",
      }),
    );
  });

  // 4. error handling sets failed status
  it("error handling sets failed status with error message", async () => {
    const opts = defaultOptions({
      maxConcurrent: 1,
      generateUploadUrl: vi.fn().mockRejectedValue(new Error("URL generation failed")),
    });

    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([createMockFile("bad-file.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.files[0]?.status).toBe("failed");
    });

    expect(result.current.files[0].error).toBe("URL generation failed");
  });

  // 5. retryFile resets failed file to queued
  it("retryFile resets failed file to queued", async () => {
    const generateUploadUrl = vi
      .fn()
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockReturnValue(new Promise(() => {})); // hang on retry so we can inspect

    const opts = defaultOptions({ maxConcurrent: 1, generateUploadUrl });
    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([createMockFile("retry-me.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.files[0]?.status).toBe("failed");
    });

    act(() => {
      result.current.retryFile(result.current.files[0].id);
    });

    // After retry it should either be queued or already getting_url
    await waitFor(() => {
      const status = result.current.files[0]?.status;
      expect(status === "queued" || status === "getting_url").toBe(true);
    });

    expect(result.current.files[0].error).toBeNull();
  });

  // 6. retryAllFailed retries all failed files
  it("retryAllFailed retries all failed files", async () => {
    const generateUploadUrl = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockReturnValue(new Promise(() => {}));

    const opts = defaultOptions({ maxConcurrent: 2, generateUploadUrl });
    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([
      createMockFile("fail-a.pdf"),
      createMockFile("fail-b.pdf"),
    ]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.files.every((f) => f.status === "failed")).toBe(true);
    });

    act(() => {
      result.current.retryAllFailed();
    });

    await waitFor(() => {
      const statuses = result.current.files.map((f) => f.status);
      expect(statuses.every((s) => s === "queued" || s === "getting_url")).toBe(true);
    });
  });

  // 7. removeFile removes and aborts if needed
  it("removeFile removes file and aborts if in progress", async () => {
    // generateUploadUrl hangs so file stays in getting_url
    const generateUploadUrl = vi.fn().mockReturnValue(new Promise(() => {}));
    const opts = defaultOptions({ maxConcurrent: 1, generateUploadUrl });
    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([createMockFile("removable.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.files[0]?.status).toBe("getting_url");
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.removeFile(fileId);
    });

    await waitFor(() => {
      expect(result.current.files).toHaveLength(0);
    });
  });

  // 8. updateCategory changes file category
  it("updateCategory changes file category", async () => {
    const opts = defaultOptions({
      maxConcurrent: 0,
      generateUploadUrl: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([createMockFile("some-file.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.files).toHaveLength(1);
    });

    expect(result.current.files[0].category).toBe("other");

    act(() => {
      result.current.updateCategory(result.current.files[0].id, "architecture" as FileCategory);
    });

    await waitFor(() => {
      expect(result.current.files[0].category).toBe("architecture");
    });
  });

  // 9. allDone computed correctly
  it("allDone is true when all files are done and false otherwise", async () => {
    installXHRMock();
    const opts = defaultOptions({ maxConcurrent: 3 });
    const { result } = renderHook(() => useUploadQueue(opts));

    // Empty files => allDone should be false
    expect(result.current.allDone).toBe(false);

    const fileList = createMockFileList([createMockFile("a.pdf"), createMockFile("b.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    // While uploading, allDone should be false
    expect(result.current.allDone).toBe(false);

    await waitFor(() => {
      expect(result.current.allDone).toBe(true);
    });
  });

  // 10. hasErrors computed correctly
  it("hasErrors is true when any file has failed and false otherwise", async () => {
    const generateUploadUrl = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockReturnValue(new Promise(() => {}));

    const opts = defaultOptions({ maxConcurrent: 2, generateUploadUrl });
    const { result } = renderHook(() => useUploadQueue(opts));

    expect(result.current.hasErrors).toBe(false);

    const fileList = createMockFileList([createMockFile("fail.pdf"), createMockFile("hang.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.hasErrors).toBe(true);
    });
  });

  // 11. isUploading computed correctly
  it("isUploading is true when files are actively uploading", async () => {
    const generateUploadUrl = vi.fn().mockReturnValue(new Promise(() => {}));

    const opts = defaultOptions({ maxConcurrent: 1, generateUploadUrl });
    const { result } = renderHook(() => useUploadQueue(opts));

    // Initially not uploading
    expect(result.current.isUploading).toBe(false);

    const fileList = createMockFileList([createMockFile("active.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(true);
    });
  });

  it("isUploading is false when all files are queued, done, or failed", async () => {
    const opts = defaultOptions({
      maxConcurrent: 0,
      generateUploadUrl: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([createMockFile("queued.pdf")]);

    act(() => {
      result.current.addFiles(fileList);
    });

    // maxConcurrent=0 means nothing starts, all stay queued
    await waitFor(() => {
      expect(result.current.files).toHaveLength(1);
    });
    expect(result.current.isUploading).toBe(false);
  });

  // 12. completedDocumentIds returns done file IDs
  it("completedDocumentIds returns only documentIds from done files", async () => {
    installXHRMock();

    let callCount = 0;
    const saveDocument = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(`doc_${callCount}`);
    });

    const opts = defaultOptions({ maxConcurrent: 3, saveDocument });
    const { result } = renderHook(() => useUploadQueue(opts));

    const fileList = createMockFileList([
      createMockFile("done-a.pdf"),
      createMockFile("done-b.pdf"),
    ]);

    act(() => {
      result.current.addFiles(fileList);
    });

    await waitFor(() => {
      expect(result.current.completedDocumentIds).toHaveLength(2);
    });

    expect(result.current.completedDocumentIds).toContain("doc_1");
    expect(result.current.completedDocumentIds).toContain("doc_2");
  });
});
