import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequirementsTable } from "./RequirementsTable";

const makeReq = (overrides = {}) => ({
  _id: "req-1",
  refId: "REQ-001",
  title: "Product Catalog Migration",
  batch: "Batch 1",
  priority: "must_have" as const,
  fitGap: "native" as const,
  effortEstimate: "medium" as const,
  status: "draft" as const,
  workstreamId: "ws-1",
  ...overrides,
});

describe("RequirementsTable", () => {
  const defaultProps = {
    requirements: [makeReq()],
    selectedId: null,
    onSelect: vi.fn(),
    workstreams: [{ _id: "ws-1", name: "Commerce", shortCode: "COM" }],
  };

  it("renders empty state when no requirements", () => {
    render(<RequirementsTable {...defaultProps} requirements={[]} />);
    expect(screen.getByText("No requirements match your filters")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<RequirementsTable {...defaultProps} />);
    expect(screen.getByText("Ref")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Workstream")).toBeInTheDocument();
  });

  it("renders requirement data in table row", () => {
    render(<RequirementsTable {...defaultProps} />);
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("Product Catalog Migration")).toBeInTheDocument();
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Native")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("COM")).toBeInTheDocument();
  });

  it("calls onSelect when row is clicked", () => {
    const onSelect = vi.fn();
    render(<RequirementsTable {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Product Catalog Migration"));
    expect(onSelect).toHaveBeenCalledWith("req-1");
  });

  it("toggles sort direction on column header click", () => {
    const reqs = [
      makeReq({ _id: "r1", refId: "REQ-002", title: "B" }),
      makeReq({ _id: "r2", refId: "REQ-001", title: "A" }),
    ];
    render(<RequirementsTable {...defaultProps} requirements={reqs} />);
    // Default sort is refId asc, so REQ-001 should be first
    const rows = screen.getAllByText(/REQ-/);
    expect(rows[0].textContent).toBe("REQ-001");
    // Click Ref to toggle to desc
    fireEvent.click(screen.getByText("Ref"));
    const rowsAfter = screen.getAllByText(/REQ-/);
    expect(rowsAfter[0].textContent).toBe("REQ-002");
  });
});
