import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type DiscoveryTab, DiscoveryTabBar } from "./DiscoveryTabBar";

const defaultProps = {
  activeTab: "documents" as DiscoveryTab,
  onTabChange: vi.fn(),
  documentCount: 5,
  analyzingCount: 0,
  pendingFindingsCount: 3,
  importedCount: 10,
  videoCount: 2,
};

describe("DiscoveryTabBar", () => {
  it("renders all 4 tabs", () => {
    render(<DiscoveryTabBar {...defaultProps} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
    expect(screen.getByText("Videos")).toBeInTheDocument();
  });

  it("active tab has accent styling class", () => {
    render(<DiscoveryTabBar {...defaultProps} activeTab="documents" />);
    const documentsButton = screen.getByText("Documents").closest("button")!;
    expect(documentsButton.className).toContain("bg-accent-default");

    const findingsButton = screen.getByText("Findings").closest("button")!;
    expect(findingsButton.className).not.toContain("bg-accent-default");
  });

  it("shows badge counts for tabs with data", () => {
    render(<DiscoveryTabBar {...defaultProps} />);

    // Document count badge = 5
    expect(screen.getByText("5")).toBeInTheDocument();
    // Findings count badge = 3
    expect(screen.getByText("3")).toBeInTheDocument();
    // Imported count badge = 10
    expect(screen.getByText("10")).toBeInTheDocument();
    // Video count badge = 2
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show badge when count is 0", () => {
    render(
      <DiscoveryTabBar
        {...defaultProps}
        documentCount={0}
        pendingFindingsCount={0}
        importedCount={0}
        videoCount={0}
      />,
    );
    // Only tab text should be present, no numeric badges
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("calls onTabChange when a tab is clicked", async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<DiscoveryTabBar {...defaultProps} onTabChange={onTabChange} />);

    await user.click(screen.getByText("Findings"));
    expect(onTabChange).toHaveBeenCalledWith("findings");

    await user.click(screen.getByText("Imported"));
    expect(onTabChange).toHaveBeenCalledWith("imported");
  });
});
