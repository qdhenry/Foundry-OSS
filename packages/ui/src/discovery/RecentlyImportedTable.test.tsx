import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

import { RecentlyImportedTable } from "./RecentlyImportedTable";

describe("RecentlyImportedTable", () => {
  const defaultProps = {
    programId: "prog-1",
    workstreams: [],
  };

  it("renders loading skeleton when data is undefined", () => {
    const { container } = render(<RecentlyImportedTable {...defaultProps} data={undefined} />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("renders empty state when no items", () => {
    render(<RecentlyImportedTable {...defaultProps} data={{ items: [], totalCount: 0 }} />);
    expect(screen.getByText(/No requirements have been imported/)).toBeInTheDocument();
  });

  it("renders table with items", () => {
    render(
      <RecentlyImportedTable
        {...defaultProps}
        data={{
          items: [
            {
              _id: "r1",
              refId: "REQ-001",
              title: "Cart Migration",
              pipelineStage: "requirement",
              workstreamName: "Payment",
              sourceDocumentName: "gap.pdf",
              importedAt: Date.now(),
            },
          ],
          totalCount: 1,
        }}
      />,
    );
    expect(screen.getByText("Recently Imported (1)")).toBeInTheDocument();
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("Cart Migration")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("gap.pdf")).toBeInTheDocument();
  });

  it("shows View All Workstreams link when workstreams exist", () => {
    render(
      <RecentlyImportedTable
        {...defaultProps}
        workstreams={[{ _id: "ws-1", name: "Payment" }]}
        data={{
          items: [
            {
              _id: "r1",
              refId: "REQ-001",
              title: "Test",
              pipelineStage: "discovery",
              sourceDocumentName: "doc.pdf",
              importedAt: Date.now(),
            },
          ],
          totalCount: 1,
        }}
      />,
    );
    expect(screen.getByText("View All Workstreams")).toBeInTheDocument();
  });
});
