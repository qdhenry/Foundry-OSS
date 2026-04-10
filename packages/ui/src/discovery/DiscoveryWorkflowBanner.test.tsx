import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryWorkflowBanner } from "./DiscoveryWorkflowBanner";

describe("DiscoveryWorkflowBanner", () => {
  const defaultProps = {
    activeTab: "documents" as const,
    documentCount: 0,
    pendingFindingsCount: 0,
    approvedCount: 0,
    importedCount: 0,
    onSwitchTab: vi.fn(),
  };

  it("returns null when no actionable state", () => {
    const { container } = render(
      <DiscoveryWorkflowBanner
        {...defaultProps}
        documentCount={1}
        pendingFindingsCount={0}
        approvedCount={0}
        importedCount={0}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows upload prompt when no documents", () => {
    render(<DiscoveryWorkflowBanner {...defaultProps} />);
    expect(screen.getByText("Start by uploading documents for AI analysis.")).toBeInTheDocument();
  });

  it("shows Go to Documents button when not on documents tab", () => {
    render(<DiscoveryWorkflowBanner {...defaultProps} activeTab="findings" />);
    expect(screen.getByText("Go to Documents")).toBeInTheDocument();
  });

  it("hides action button when already on correct tab", () => {
    render(<DiscoveryWorkflowBanner {...defaultProps} activeTab="documents" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows pending findings message with correct count", () => {
    render(
      <DiscoveryWorkflowBanner {...defaultProps} documentCount={1} pendingFindingsCount={3} />,
    );
    expect(screen.getByText("3 findings ready for review.")).toBeInTheDocument();
  });

  it("uses singular for 1 pending finding", () => {
    render(
      <DiscoveryWorkflowBanner {...defaultProps} documentCount={1} pendingFindingsCount={1} />,
    );
    expect(screen.getByText("1 finding ready for review.")).toBeInTheDocument();
  });

  it("shows approved message when approved count > 0", () => {
    render(<DiscoveryWorkflowBanner {...defaultProps} documentCount={1} approvedCount={5} />);
    expect(screen.getByText("5 approved findings ready to import.")).toBeInTheDocument();
  });

  it("shows imported message when all processed", () => {
    render(<DiscoveryWorkflowBanner {...defaultProps} documentCount={1} importedCount={3} />);
    expect(
      screen.getByText("All findings processed. Track progress in workstream pipelines."),
    ).toBeInTheDocument();
  });

  it("calls onSwitchTab when action button clicked", () => {
    const onSwitchTab = vi.fn();
    render(
      <DiscoveryWorkflowBanner {...defaultProps} activeTab="findings" onSwitchTab={onSwitchTab} />,
    );
    fireEvent.click(screen.getByText("Go to Documents"));
    expect(onSwitchTab).toHaveBeenCalledWith("documents");
  });
});
