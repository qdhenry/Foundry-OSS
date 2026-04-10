import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDriveImportQueue } from "./useDriveImportQueue";
import type { DriveFile } from "./useGooglePicker";

const file1: DriveFile = { id: "f1", name: "Design.pdf", mimeType: "application/pdf" };
const file2: DriveFile = {
  id: "f2",
  name: "Spec.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function makeHook(importFromDrive: ReturnType<typeof vi.fn>) {
  return renderHook(() =>
    useDriveImportQueue({ orgId: "org-1", programId: "prog-1", importFromDrive }),
  );
}

describe("useDriveImportQueue", () => {
  beforeEach(() => {
    // Return null from RAF so rafRef.current stays null after the assignment
    // (the callback sets rafRef.current = null, then null is re-assigned from return value)
    // This allows every sync() call to fire RAF immediately without the guard blocking it.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return null as unknown as number;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty state", () => {
    const { result } = makeHook(vi.fn());
    expect(result.current.imports).toEqual([]);
    expect(result.current.isImporting).toBe(false);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.completedDocumentIds).toEqual([]);
  });

  it("sets isImporting to false after import completes", async () => {
    const importFromDrive = vi.fn().mockResolvedValue([{ fileId: "f1", documentId: "doc-1" }]);
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([file1], "cred-1");
    });

    expect(result.current.isImporting).toBe(false);
  });

  it("marks files as done on successful import", async () => {
    const importFromDrive = vi.fn().mockResolvedValue([{ fileId: "f1", documentId: "doc-1" }]);
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([file1], "cred-1");
    });

    expect(result.current.imports).toHaveLength(1);
    expect(result.current.imports[0]).toMatchObject({
      id: "f1",
      name: "Design.pdf",
      status: "done",
      documentId: "doc-1",
    });
  });

  it("marks file as failed when result contains error", async () => {
    const importFromDrive = vi
      .fn()
      .mockResolvedValue([{ fileId: "f1", error: "File type not supported" }]);
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([file1], "cred-1");
    });

    expect(result.current.imports[0]).toMatchObject({
      id: "f1",
      status: "failed",
      error: "File type not supported",
    });
    expect(result.current.hasErrors).toBe(true);
  });

  it("marks all files as failed on batch-level error (importFromDrive throws)", async () => {
    const importFromDrive = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([file1, file2], "cred-1");
    });

    expect(result.current.imports).toHaveLength(2);
    for (const item of result.current.imports) {
      expect(item.status).toBe("failed");
      expect(item.error).toBe("Network error");
    }
    expect(result.current.hasErrors).toBe(true);
  });

  it("populates completedDocumentIds from done imports", async () => {
    const importFromDrive = vi.fn().mockResolvedValue([
      { fileId: "f1", documentId: "doc-1" },
      { fileId: "f2", documentId: "doc-2" },
    ]);
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([file1, file2], "cred-1");
    });

    expect(result.current.completedDocumentIds).toEqual(expect.arrayContaining(["doc-1", "doc-2"]));
  });

  it("isImporting flag is false when no imports are running", () => {
    const { result } = makeHook(vi.fn());
    expect(result.current.isImporting).toBe(false);
  });

  it("removeImport removes a specific item by id", async () => {
    const importFromDrive = vi.fn().mockResolvedValue([
      { fileId: "f1", error: "Failed" },
      { fileId: "f2", documentId: "doc-2" },
    ]);
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([file1, file2], "cred-1");
    });

    act(() => {
      result.current.removeImport("f1");
    });

    expect(result.current.imports).toHaveLength(1);
    expect(result.current.imports[0].id).toBe("f2");
  });

  it("clearCompleted removes all done imports, leaving failed ones", async () => {
    const importFromDrive = vi.fn().mockResolvedValue([
      { fileId: "f1", documentId: "doc-1" },
      { fileId: "f2", error: "Failed" },
    ]);
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([file1, file2], "cred-1");
    });

    act(() => {
      result.current.clearCompleted();
    });

    expect(result.current.imports).toHaveLength(1);
    expect(result.current.imports[0].status).toBe("failed");
  });

  it("auto-clears done imports after 3 seconds", async () => {
    // Fake only timers (not RAF) so our spy stays in effect
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const importFromDrive = vi.fn().mockResolvedValue([{ fileId: "f1", documentId: "doc-1" }]);
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([file1], "cred-1");
    });

    expect(result.current.imports).toHaveLength(1);
    expect(result.current.imports[0].status).toBe("done");

    // Advance past the 3s auto-clear timer
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(result.current.imports).toHaveLength(0);

    vi.useRealTimers();
  });

  it("does not call importFromDrive when files array is empty", async () => {
    const importFromDrive = vi.fn();
    const { result } = makeHook(importFromDrive);

    await act(async () => {
      await result.current.startImport([], "cred-1");
    });

    expect(importFromDrive).not.toHaveBeenCalled();
    expect(result.current.imports).toHaveLength(0);
  });
});
