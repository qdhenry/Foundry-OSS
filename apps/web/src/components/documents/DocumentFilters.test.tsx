import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentFilters } from "./DocumentFilters";

describe("DocumentFilters", () => {
  it("renders with All Categories selected by default", () => {
    render(<DocumentFilters selectedCategory={undefined} onCategoryChange={vi.fn()} />);
    expect(screen.getByText("All Categories")).toBeInTheDocument();
  });

  it("renders all category options", () => {
    render(<DocumentFilters selectedCategory={undefined} onCategoryChange={vi.fn()} />);
    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
    expect(screen.getByText("Deployment")).toBeInTheDocument();
    expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("hides Clear filter when no category is selected", () => {
    render(<DocumentFilters selectedCategory={undefined} onCategoryChange={vi.fn()} />);
    expect(screen.queryByText("Clear filter")).not.toBeInTheDocument();
  });

  it("shows Clear filter when a category is selected", () => {
    render(<DocumentFilters selectedCategory="architecture" onCategoryChange={vi.fn()} />);
    expect(screen.getByText("Clear filter")).toBeInTheDocument();
  });

  it("calls onCategoryChange with undefined when cleared", () => {
    const onCategoryChange = vi.fn();
    render(<DocumentFilters selectedCategory="testing" onCategoryChange={onCategoryChange} />);
    fireEvent.click(screen.getByText("Clear filter"));
    expect(onCategoryChange).toHaveBeenCalledWith(undefined);
  });

  it("calls onCategoryChange with selected value", () => {
    const onCategoryChange = vi.fn();
    render(<DocumentFilters selectedCategory={undefined} onCategoryChange={onCategoryChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "architecture" } });
    expect(onCategoryChange).toHaveBeenCalledWith("architecture");
  });

  it("calls onCategoryChange with undefined when All Categories is selected", () => {
    const onCategoryChange = vi.fn();
    render(<DocumentFilters selectedCategory="architecture" onCategoryChange={onCategoryChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(onCategoryChange).toHaveBeenCalledWith(undefined);
  });
});
