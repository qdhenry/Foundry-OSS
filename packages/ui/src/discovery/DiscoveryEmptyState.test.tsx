import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryEmptyState } from "./DiscoveryEmptyState";

describe("DiscoveryEmptyState", () => {
  it("renders heading and description", () => {
    render(<DiscoveryEmptyState onCreateRequirement={vi.fn()} onOpenDocuments={vi.fn()} />);
    expect(screen.getByText("Start Your Discovery Hub")).toBeInTheDocument();
    expect(screen.getByText(/Upload source documents for AI extraction/)).toBeInTheDocument();
  });

  it("calls onOpenDocuments when button clicked", () => {
    const onOpenDocuments = vi.fn();
    render(<DiscoveryEmptyState onCreateRequirement={vi.fn()} onOpenDocuments={onOpenDocuments} />);
    fireEvent.click(screen.getByText("Open Document Zone"));
    expect(onOpenDocuments).toHaveBeenCalledOnce();
  });

  it("calls onCreateRequirement when button clicked", () => {
    const onCreateRequirement = vi.fn();
    render(
      <DiscoveryEmptyState onCreateRequirement={onCreateRequirement} onOpenDocuments={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("Create Requirement"));
    expect(onCreateRequirement).toHaveBeenCalledOnce();
  });
});
