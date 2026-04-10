import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./ActivityPage", () => ({
  ActivityPage: () => <div data-testid="activity-page">Activity</div>,
}));

import { ProgramActivityRoute } from "./ProgramActivityRoute";

describe("ProgramActivityRoute", () => {
  it("renders ActivityPage", () => {
    render(<ProgramActivityRoute />);
    expect(screen.getByTestId("activity-page")).toBeInTheDocument();
  });
});
