import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentCard } from "./DocumentCard";

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    _id: "doc-1",
    _creationTime: new Date("2025-01-01T10:00:00Z").getTime(),
    fileName: "analysis.pdf",
    fileType: "application/pdf",
    fileSize: 1024,
    category: "requirements",
    uploaderName: "Jordan",
    downloadUrl: null,
    ...overrides,
  };
}

describe("DocumentCard", () => {
  it("opens analysis panel when status is complete", () => {
    const onViewAnalysis = vi.fn();

    render(
      <table>
        <tbody>
          <DocumentCard
            document={makeDocument({ analysisStatus: "complete" }) as any}
            onDelete={vi.fn()}
            onViewAnalysis={onViewAnalysis}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Analyzed" }));
    expect(onViewAnalysis).toHaveBeenCalledWith("doc-1");
  });

  it("also opens analysis panel when status is completed", () => {
    const onViewAnalysis = vi.fn();

    render(
      <table>
        <tbody>
          <DocumentCard
            document={makeDocument({ analysisStatus: "completed" }) as any}
            onDelete={vi.fn()}
            onViewAnalysis={onViewAnalysis}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Analyzed" }));
    expect(onViewAnalysis).toHaveBeenCalledWith("doc-1");
  });
});
