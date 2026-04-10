import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryStats } from "./DiscoveryStats";

describe("DiscoveryStats", () => {
  const defaultProps = {
    documentCount: 3,
    pendingFindingsCount: 57,
    requirementsCount: 90,
    analyzingCount: 0,
  };

  it("renders all four stat card labels", () => {
    render(<DiscoveryStats {...defaultProps} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Pending Findings")).toBeInTheDocument();
    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Analyzing")).toBeInTheDocument();
  });

  it("renders stat values", () => {
    render(<DiscoveryStats {...defaultProps} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("57")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("calls onStatClick with correct tab target", () => {
    const onStatClick = vi.fn();
    render(<DiscoveryStats {...defaultProps} onStatClick={onStatClick} />);
    fireEvent.click(screen.getByText("Documents"));
    expect(onStatClick).toHaveBeenCalledWith("documents");
    fireEvent.click(screen.getByText("Pending Findings"));
    expect(onStatClick).toHaveBeenCalledWith("findings");
    fireEvent.click(screen.getByText("Requirements"));
    expect(onStatClick).toHaveBeenCalledWith("imported");
  });

  it("renders without onStatClick (optional prop)", () => {
    render(<DiscoveryStats {...defaultProps} />);
    // Should not throw when clicking without handler
    fireEvent.click(screen.getByText("Documents"));
  });
});
