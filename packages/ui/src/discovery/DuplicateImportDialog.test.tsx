import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicateImportDialog } from "./DuplicateImportDialog";

const singleDuplicate = [
  { driveFileId: "file-1", fileName: "Report.pdf", importedAt: new Date("2026-01-15").getTime() },
];

const multiDuplicates = [
  { driveFileId: "file-1", fileName: "Report.pdf", importedAt: new Date("2026-01-15").getTime() },
  { driveFileId: "file-2", fileName: "Spec.docx", importedAt: new Date("2026-02-20").getTime() },
];

describe("DuplicateImportDialog", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <DuplicateImportDialog
        isOpen={false}
        duplicates={singleDuplicate}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows singular heading for one duplicate", () => {
    render(
      <DuplicateImportDialog
        isOpen
        duplicates={singleDuplicate}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText("File already imported")).toBeInTheDocument();
    expect(
      screen.getByText("This file has already been imported into this program."),
    ).toBeInTheDocument();
  });

  it("shows plural heading for multiple duplicates", () => {
    render(
      <DuplicateImportDialog
        isOpen
        duplicates={multiDuplicates}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText("Files already imported")).toBeInTheDocument();
    expect(
      screen.getByText("2 of the selected files have already been imported."),
    ).toBeInTheDocument();
  });

  it("renders all file names in the list", () => {
    render(
      <DuplicateImportDialog
        isOpen
        duplicates={multiDuplicates}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText("Report.pdf")).toBeInTheDocument();
    expect(screen.getByText("Spec.docx")).toBeInTheDocument();
  });

  it("calls onConfirm when Import anyway is clicked", () => {
    render(
      <DuplicateImportDialog
        isOpen
        duplicates={singleDuplicate}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Import anyway"));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    render(
      <DuplicateImportDialog
        isOpen
        duplicates={singleDuplicate}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape key is pressed", () => {
    render(
      <DuplicateImportDialog
        isOpen
        duplicates={singleDuplicate}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
