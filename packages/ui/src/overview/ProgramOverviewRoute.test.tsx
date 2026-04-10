import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../programs/ProgramContext", () => ({
  useProgramContext: () => ({
    program: {
      name: "Test Program",
      clientName: "Client",
      phase: "build",
      status: "active",
      stats: { totalRequirements: 5, agentExecutionCount: 2 },
    },
    programId: "prog-1",
    slug: "test-program",
  }),
}));

vi.mock("./OverviewPage", () => ({
  OverviewPage: (props: any) => (
    <div data-testid="overview-page">
      {props.programId}-{props.programSlug}
    </div>
  ),
}));

import { ProgramOverviewRoute } from "./ProgramOverviewRoute";

describe("ProgramOverviewRoute", () => {
  it("renders OverviewPage with context props", () => {
    render(<ProgramOverviewRoute />);
    expect(screen.getByTestId("overview-page")).toHaveTextContent("prog-1-test-program");
  });
});
