import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock URL APIs
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

import { exportRequirementsCsv } from "./exportCsv";

describe("exportRequirementsCsv", () => {
  let mockLink: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLink = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as any);
  });

  it("generates CSV with correct headers", async () => {
    exportRequirementsCsv([]);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toBe("Ref ID,Title,Priority,Status,Workstream,Tasks");
  });

  it("includes data rows", async () => {
    exportRequirementsCsv([
      {
        refId: "REQ-001",
        title: "Test requirement",
        priority: "must_have",
        status: "draft",
        workstreamName: "Data Migration",
        taskCount: 5,
      },
    ]);

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    const lines = text.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("REQ-001,Test requirement,must_have,draft,Data Migration,5");
  });

  it("escapes values containing commas", async () => {
    exportRequirementsCsv([
      {
        refId: "REQ-002",
        title: "Title, with comma",
        priority: "should_have",
        status: "approved",
        workstreamName: null,
        taskCount: 0,
      },
    ]);

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    const lines = text.split("\n");
    expect(lines[1]).toContain('"Title, with comma"');
  });

  it("handles null workstreamName", async () => {
    exportRequirementsCsv([
      {
        refId: "REQ-003",
        title: "No workstream",
        priority: "nice_to_have",
        status: "draft",
        workstreamName: null,
        taskCount: 0,
      },
    ]);

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    const lines = text.split("\n");
    // Workstream column should be empty
    const columns = lines[1].split(",");
    expect(columns[4]).toBe("");
  });

  it("sets correct filename with date", () => {
    exportRequirementsCsv([]);

    const pattern = /^requirements-export-\d{4}-\d{2}-\d{2}\.csv$/;
    expect(mockLink.download).toMatch(pattern);
  });

  it("cleans up object URL after download", () => {
    exportRequirementsCsv([]);

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
