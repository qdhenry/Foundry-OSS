import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReAnalyzeDialog } from "./ReAnalyzeDialog";

describe("ReAnalyzeDialog", () => {
  const defaultProps = {
    isOpen: true,
    documentName: "gap_analysis.pdf",
    defaultTargetPlatform: "salesforce_b2b" as const,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("returns null when isOpen is false", () => {
    const { container } = render(<ReAnalyzeDialog {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders heading with document name", () => {
    render(<ReAnalyzeDialog {...defaultProps} />);
    expect(screen.getByText("Re-analyze gap_analysis.pdf")).toBeInTheDocument();
  });

  it("renders focus area and target platform selects", () => {
    render(<ReAnalyzeDialog {...defaultProps} />);
    expect(screen.getByText("All findings")).toBeInTheDocument();
    expect(screen.getByText("Salesforce B2B Commerce")).toBeInTheDocument();
  });

  it("renders suggestion buttons", () => {
    render(<ReAnalyzeDialog {...defaultProps} />);
    expect(screen.getByText("Focus on payment and checkout integrations")).toBeInTheDocument();
    expect(screen.getByText("Prioritize security and compliance risks")).toBeInTheDocument();
  });

  it("fills instructions when suggestion clicked", () => {
    render(<ReAnalyzeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Focus on payment and checkout integrations"));
    const textarea = screen.getByPlaceholderText("Optional instructions for the next run");
    expect(textarea).toHaveValue("Focus on payment and checkout integrations");
  });

  it("shows character count", () => {
    render(<ReAnalyzeDialog {...defaultProps} />);
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel clicked", () => {
    const onCancel = vi.fn();
    render(<ReAnalyzeDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders Re-analyze button", () => {
    render(<ReAnalyzeDialog {...defaultProps} />);
    expect(screen.getByText("Re-analyze")).toBeInTheDocument();
  });
});
