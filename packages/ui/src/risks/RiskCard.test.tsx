import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockRouter = { push: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "my-prog" }),
}));

import { RiskCard } from "./RiskCard";

const baseRisk = {
  _id: "risk_1",
  title: "Migration timeline risk",
  description: "Data migration may exceed the estimated timeline",
  severity: "high" as const,
  probability: "likely" as const,
  status: "open" as const,
};

describe("RiskCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders risk title", () => {
    render(<RiskCard risk={baseRisk} programId="prog_1" />);
    expect(screen.getByText("Migration timeline risk")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<RiskCard risk={baseRisk} programId="prog_1" />);
    expect(
      screen.getByText("Data migration may exceed the estimated timeline"),
    ).toBeInTheDocument();
  });

  it("shows severity and probability badges", () => {
    render(<RiskCard risk={baseRisk} programId="prog_1" />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Likely")).toBeInTheDocument();
  });

  it("shows status badge", () => {
    render(<RiskCard risk={baseRisk} programId="prog_1" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("navigates to risk detail on click", () => {
    render(<RiskCard risk={baseRisk} programId="prog_1" />);
    fireEvent.click(screen.getByText("Migration timeline risk"));
    expect(mockRouter.push).toHaveBeenCalledWith("/my-prog/risks/risk_1");
  });

  it("shows owner name when provided", () => {
    render(<RiskCard risk={{ ...baseRisk, ownerName: "John Doe" }} programId="prog_1" />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows workstream short codes when provided", () => {
    render(
      <RiskCard
        risk={{
          ...baseRisk,
          resolvedWorkstreams: [
            { _id: "ws1", name: "Frontend", shortCode: "FE" },
            { _id: "ws2", name: "Backend", shortCode: "BE" },
          ],
        }}
        programId="prog_1"
      />,
    );
    expect(screen.getByText("FE")).toBeInTheDocument();
    expect(screen.getByText("BE")).toBeInTheDocument();
  });
});
