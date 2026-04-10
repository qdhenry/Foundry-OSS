import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramWorkstreamDetailRoute } from "./ProgramWorkstreamDetailRoute";

vi.mock("next/navigation", () => ({
  useParams: () => ({ workstreamId: "ws-1" }),
}));

vi.mock("./WorkstreamDetailPage", () => ({
  WorkstreamDetailPage: ({ workstreamId }: { workstreamId: string }) => (
    <div data-testid="workstream-detail">{workstreamId}</div>
  ),
}));

describe("ProgramWorkstreamDetailRoute", () => {
  it("renders WorkstreamDetailPage with workstreamId param", () => {
    render(<ProgramWorkstreamDetailRoute />);
    expect(screen.getByTestId("workstream-detail")).toHaveTextContent("ws-1");
  });
});
