import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryWorkflowBanner } from "./DiscoveryWorkflowBanner";

describe("DiscoveryWorkflowBanner", () => {
  const baseProps = {
    activeTab: "documents" as const,
    documentCount: 0,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 0,
    onSwitchTab: vi.fn(),
  };

  it("shows upload prompt when no documents", () => {
    render(<DiscoveryWorkflowBanner {...baseProps} />);
    expect(screen.getByText("Start by uploading documents for AI analysis.")).toBeInTheDocument();
  });

  it("shows Go to Documents action when activeTab is not documents and no docs", () => {
    const onSwitchTab = vi.fn();
    render(
      <DiscoveryWorkflowBanner {...baseProps} activeTab="findings" onSwitchTab={onSwitchTab} />,
    );
    fireEvent.click(screen.getByText("Go to Documents"));
    expect(onSwitchTab).toHaveBeenCalledWith("documents");
  });

  it("shows pending findings message", () => {
    render(<DiscoveryWorkflowBanner {...baseProps} documentCount={2} pendingFindingsCount={5} />);
    expect(screen.getByText("5 findings ready for review.")).toBeInTheDocument();
  });

  it("shows singular finding message", () => {
    render(<DiscoveryWorkflowBanner {...baseProps} documentCount={1} pendingFindingsCount={1} />);
    expect(screen.getByText("1 finding ready for review.")).toBeInTheDocument();
  });

  it("shows approved findings message", () => {
    render(<DiscoveryWorkflowBanner {...baseProps} documentCount={1} approvedCount={3} />);
    expect(screen.getByText("3 approved findings ready to import.")).toBeInTheDocument();
  });

  it("shows imported message", () => {
    render(<DiscoveryWorkflowBanner {...baseProps} documentCount={1} importedCount={5} />);
    expect(
      screen.getByText("All findings processed. Track progress in workstream pipelines."),
    ).toBeInTheDocument();
  });

  it("returns null when no actionable state", () => {
    const { container } = render(
      <DiscoveryWorkflowBanner
        {...baseProps}
        documentCount={1}
        pendingFindingsCount={0}
        approvedCount={0}
        importedCount={0}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
