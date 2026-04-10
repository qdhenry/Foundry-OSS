import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DailyDigest } from "./DailyDigest";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useAction: () => vi.fn(),
}));

vi.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

describe("DailyDigest", () => {
  it("renders the pulse heading", () => {
    render(<DailyDigest programId="prog_1" lastVisitTime={Date.now() - 86400000} />);
    expect(screen.getByText("Mission Control Pulse")).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    render(<DailyDigest programId="prog_1" lastVisitTime={Date.now() - 86400000} />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("shows loading skeleton when no data", () => {
    render(<DailyDigest programId="prog_1" lastVisitTime={Date.now() - 86400000} />);
    expect(screen.getByTitle("Refresh pulse with latest data")).toBeInTheDocument();
  });
});
