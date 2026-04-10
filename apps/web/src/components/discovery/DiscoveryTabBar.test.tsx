import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryTabBar } from "./DiscoveryTabBar";

describe("DiscoveryTabBar", () => {
  const defaultProps = {
    activeTab: "documents" as const,
    onTabChange: vi.fn(),
    documentCount: 5,
    analyzingCount: 0,
    pendingFindingsCount: 3,
    importedCount: 10,
  };

  it("renders all three tab labels", () => {
    render(<DiscoveryTabBar {...defaultProps} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });

  it("shows badges for non-zero counts", () => {
    render(<DiscoveryTabBar {...defaultProps} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("hides badges when counts are zero", () => {
    render(
      <DiscoveryTabBar
        {...defaultProps}
        documentCount={0}
        pendingFindingsCount={0}
        importedCount={0}
      />,
    );
    // Only the tab labels should exist, no numeric badges
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(<DiscoveryTabBar {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("Findings"));
    expect(onTabChange).toHaveBeenCalledWith("findings");
  });
});
