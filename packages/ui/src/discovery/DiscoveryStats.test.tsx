import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryStats } from "./DiscoveryStats";

describe("DiscoveryStats", () => {
  const defaultProps = {
    documentCount: 3,
    pendingFindingsCount: 57,
    requirementsCount: 90,
    analyzingCount: 0,
  };

  it("renders stat card labels and values", () => {
    render(<DiscoveryStats {...defaultProps} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Pending Findings")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
    expect(screen.getByText("57")).toBeInTheDocument();
  });

  it("shows skeleton when loading prop is true", () => {
    const { container } = render(<DiscoveryStats {...defaultProps} loading />);
    const skeletons = container.querySelectorAll("[data-skeleton]");
    expect(skeletons.length).toBe(4);
    // Should not show stat labels when loading
    expect(screen.queryByText("Documents")).not.toBeInTheDocument();
  });

  it("adds title tooltips to stat cards", () => {
    render(<DiscoveryStats {...defaultProps} />);
    const docCard = screen.getByText("Documents").closest("button");
    expect(docCard).toHaveAttribute("title", "Total documents uploaded for analysis");
  });

  it("calls onStatClick when a stat card is clicked", async () => {
    const onStatClick = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<DiscoveryStats {...defaultProps} onStatClick={onStatClick} />);
    await user.click(screen.getByText("Documents").closest("button")!);
    expect(onStatClick).toHaveBeenCalledWith("documents");
  });
});
