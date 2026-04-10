import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GraphControls } from "./GraphControls";

const defaultProps = {
  activeFilters: new Set(["api", "service", "data", "ui", "utility", "config", "test"]),
  onFilterToggle: vi.fn(),
  searchQuery: "",
  onSearchChange: vi.fn(),
  nodeCount: 42,
};

describe("GraphControls", () => {
  it("renders layer filter buttons", () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("Service")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();
    expect(screen.getByText("UI")).toBeInTheDocument();
    expect(screen.getByText("Utility")).toBeInTheDocument();
    expect(screen.getByText("Config")).toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("shows node count", () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByText("42 nodes")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search nodes...")).toBeInTheDocument();
  });

  it("calls onFilterToggle when layer clicked", async () => {
    const user = userEvent.setup();
    const onFilterToggle = vi.fn();
    render(<GraphControls {...defaultProps} onFilterToggle={onFilterToggle} />);
    await user.click(screen.getByText("API"));
    expect(onFilterToggle).toHaveBeenCalledWith("api");
  });

  it("calls onSearchChange when typing", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<GraphControls {...defaultProps} onSearchChange={onSearchChange} />);
    await user.type(screen.getByPlaceholderText("Search nodes..."), "x");
    expect(onSearchChange).toHaveBeenCalled();
  });
});
