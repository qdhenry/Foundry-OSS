import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentUploadZone } from "./DocumentUploadZone";

describe("DocumentUploadZone", () => {
  const defaultProps = {
    onFileSelect: vi.fn(),
    selectedFile: null,
    onClear: vi.fn(),
  };

  it("renders drop zone prompt when no file selected", () => {
    render(<DocumentUploadZone {...defaultProps} />);
    expect(screen.getByText("Drag and drop a file, or click to browse")).toBeInTheDocument();
    expect(
      screen.getByText("PDF, DOCX, XLSX, images, and other file types supported"),
    ).toBeInTheDocument();
  });

  it("renders selected file info when file is provided", () => {
    const file = new File(["test"], "document.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 1024 });
    render(<DocumentUploadZone {...defaultProps} selectedFile={file} />);
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
    expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    const file = new File(["test"], "document.pdf", { type: "application/pdf" });
    render(<DocumentUploadZone {...defaultProps} selectedFile={file} onClear={onClear} />);
    // Find the clear button (the X button next to the file)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("has a hidden file input", () => {
    const { container } = render(<DocumentUploadZone {...defaultProps} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("hidden");
  });
});
