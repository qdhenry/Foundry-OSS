import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./NewPlaybookPage", () => ({
  __esModule: true,
  default: () => <div data-testid="new-playbook-page">NewPlaybookPage</div>,
}));

import { ProgramPlaybookNewRoute } from "./ProgramPlaybookNewRoute";

describe("ProgramPlaybookNewRoute", () => {
  it("renders NewPlaybookPage", () => {
    render(<ProgramPlaybookNewRoute />);
    expect(screen.getByTestId("new-playbook-page")).toBeInTheDocument();
  });
});
