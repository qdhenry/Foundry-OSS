import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineDocumentDrawer } from "./PipelineDocumentDrawer";

vi.mock("convex/react", () => ({
  useQuery: () => [],
}));

describe("PipelineDocumentDrawer", () => {
  it("returns null when not open", () => {
    const { container } = render(
      <PipelineDocumentDrawer programId="prog-1" isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders heading when open", () => {
    render(<PipelineDocumentDrawer programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });

  it("shows empty message when no documents", () => {
    render(<PipelineDocumentDrawer programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("No documents uploaded for this program.")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PipelineDocumentDrawer programId="prog-1" isOpen={true} onClose={onClose} />);
    // Click the close button (the SVG X button)
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
