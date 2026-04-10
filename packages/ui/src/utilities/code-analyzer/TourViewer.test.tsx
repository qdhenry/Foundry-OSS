import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TourViewer } from "./TourViewer";

let queryReturn: any;
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => queryReturn,
}));

describe("TourViewer", () => {
  it("shows empty state when no tours", () => {
    queryReturn = [];
    render(<TourViewer analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("No guided tours available for this analysis.")).toBeInTheDocument();
  });

  it("renders tour header", () => {
    queryReturn = [
      {
        name: "Auth Flow",
        description: "Walk through authentication",
        steps: [{ title: "Step 1", explanation: "First step" }],
      },
    ];
    render(<TourViewer analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("Auth Flow")).toBeInTheDocument();
    expect(screen.getByText("Walk through authentication")).toBeInTheDocument();
  });

  it("renders step content", () => {
    queryReturn = [
      {
        name: "Tour",
        steps: [{ title: "Init", explanation: "Initialize the module" }],
      },
    ];
    render(<TourViewer analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("Init")).toBeInTheDocument();
    expect(screen.getByText("Initialize the module")).toBeInTheDocument();
  });

  it("shows step counter", () => {
    queryReturn = [
      {
        name: "Tour",
        steps: [
          { title: "S1", explanation: "one" },
          { title: "S2", explanation: "two" },
        ],
      },
    ];
    render(<TourViewer analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
  });

  it("navigates to next step", async () => {
    const user = userEvent.setup();
    queryReturn = [
      {
        name: "Tour",
        steps: [
          { title: "S1", explanation: "one" },
          { title: "S2", explanation: "two" },
        ],
      },
    ];
    render(<TourViewer analysisId="a-1" orgId="org-1" />);
    await user.click(screen.getByText("Next"));
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("S2")).toBeInTheDocument();
  });
});
