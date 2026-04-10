import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./PlaybooksPage", () => ({
  __esModule: true,
  default: () => <div data-testid="playbooks-page">PlaybooksPage</div>,
}));

import { ProgramPlaybooksRoute } from "./ProgramPlaybooksRoute";

describe("ProgramPlaybooksRoute", () => {
  it("renders PlaybooksPage", () => {
    render(<ProgramPlaybooksRoute />);
    expect(screen.getByTestId("playbooks-page")).toBeInTheDocument();
  });
});
