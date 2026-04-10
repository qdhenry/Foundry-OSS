import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineDocumentDrawer } from "./PipelineDocumentDrawer";

let mockQueryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: (_fn: any, args: any) => {
    if (args === "skip") return undefined;
    return mockQueryReturn;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    documents: {
      listByProgram: "documents:listByProgram",
    },
  },
}));

describe("PipelineDocumentDrawer", () => {
  const onClose = vi.fn();

  it("returns null when not open", () => {
    mockQueryReturn = [];
    const { container } = render(
      <PipelineDocumentDrawer programId={"prog-1" as any} isOpen={false} onClose={onClose} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders Documents heading when open", () => {
    mockQueryReturn = [];
    render(<PipelineDocumentDrawer programId={"prog-1" as any} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });

  it("shows loading skeletons when data is undefined", () => {
    mockQueryReturn = undefined;
    const { container } = render(
      <PipelineDocumentDrawer programId={"prog-1" as any} isOpen={true} onClose={onClose} />,
    );
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBe(3);
  });

  it("shows empty state when no documents", () => {
    mockQueryReturn = [];
    render(<PipelineDocumentDrawer programId={"prog-1" as any} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("No documents uploaded for this program.")).toBeInTheDocument();
  });

  it("renders document file names", () => {
    mockQueryReturn = [
      { _id: "d1", fileName: "requirements.pdf", fileSize: 2048, analysisStatus: "completed" },
      { _id: "d2", fileName: "design.docx", fileSize: null },
    ];
    render(<PipelineDocumentDrawer programId={"prog-1" as any} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("requirements.pdf")).toBeInTheDocument();
    expect(screen.getByText("design.docx")).toBeInTheDocument();
  });

  it("renders file size and analysis status", () => {
    mockQueryReturn = [
      { _id: "d1", fileName: "spec.pdf", fileSize: 5120, analysisStatus: "completed" },
    ];
    render(<PipelineDocumentDrawer programId={"prog-1" as any} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("5.0 KB · completed")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    mockQueryReturn = [];
    const closeFn = vi.fn();
    const user = userEvent.setup();
    render(<PipelineDocumentDrawer programId={"prog-1" as any} isOpen={true} onClose={closeFn} />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);
    expect(closeFn).toHaveBeenCalled();
  });

  it("calls onClose when backdrop clicked", async () => {
    mockQueryReturn = [];
    const closeFn = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <PipelineDocumentDrawer programId={"prog-1" as any} isOpen={true} onClose={closeFn} />,
    );
    const backdrop = container.querySelector(".bg-black\\/30");
    if (backdrop) await user.click(backdrop);
    expect(closeFn).toHaveBeenCalled();
  });
});
