import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindingsPagination } from "./FindingsPagination";

describe("FindingsPagination", () => {
  it("returns null when totalPages is 1", () => {
    const { container } = render(
      <FindingsPagination currentPage={0} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when totalPages is 0", () => {
    const { container } = render(
      <FindingsPagination currentPage={0} totalPages={0} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pagination controls when totalPages > 1", () => {
    render(<FindingsPagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
  });

  it("disables Previous on first page", () => {
    render(<FindingsPagination currentPage={0} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("disables Next on last page", () => {
    render(<FindingsPagination currentPage={2} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByText("Next")).toBeDisabled();
    expect(screen.getByText("Previous")).not.toBeDisabled();
  });

  it("calls onPageChange with correct page on Previous click", () => {
    const onPageChange = vi.fn();
    render(<FindingsPagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText("Previous"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange with correct page on Next click", () => {
    const onPageChange = vi.fn();
    render(<FindingsPagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
