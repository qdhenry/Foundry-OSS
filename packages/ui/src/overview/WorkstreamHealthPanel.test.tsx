import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkstreamHealthPanel } from "./WorkstreamHealthPanel";

vi.mock("next/link", () => ({
  default: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("../programs/ProgramContext", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

vi.mock("../mission-control/HealthScoreCard", () => ({
  HealthScoreCard: ({ workstreamName }: any) => (
    <div data-testid="health-score-card">{workstreamName}</div>
  ),
}));

describe("WorkstreamHealthPanel", () => {
  const defaultProps = {
    workstreamId: "ws-1",
    workstreamName: "Auth Module",
    open: true,
    onClose: vi.fn(),
  };

  it("renders nothing when closed", () => {
    const { container } = render(<WorkstreamHealthPanel {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Workstream Health heading when open", () => {
    render(<WorkstreamHealthPanel {...defaultProps} />);
    expect(screen.getByText("Workstream Health")).toBeInTheDocument();
  });

  it("renders HealthScoreCard with workstream name", () => {
    render(<WorkstreamHealthPanel {...defaultProps} />);
    expect(screen.getByTestId("health-score-card")).toHaveTextContent("Auth Module");
  });

  it("renders View Full Workstream link", () => {
    render(<WorkstreamHealthPanel {...defaultProps} />);
    const link = screen.getByText("View Full Workstream");
    expect(link).toHaveAttribute("href", "/test-program/workstreams/ws-1");
  });

  it("calls onClose on Escape key", async () => {
    const onClose = vi.fn();
    render(<WorkstreamHealthPanel {...defaultProps} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
