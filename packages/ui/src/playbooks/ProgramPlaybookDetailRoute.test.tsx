import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./PlaybookDetailPage", () => ({
  __esModule: true,
  default: () => <div data-testid="playbook-detail-page">PlaybookDetailPage</div>,
}));

import { ProgramPlaybookDetailRoute } from "./ProgramPlaybookDetailRoute";

describe("ProgramPlaybookDetailRoute", () => {
  it("renders PlaybookDetailPage", () => {
    render(<ProgramPlaybookDetailRoute />);
    expect(screen.getByTestId("playbook-detail-page")).toBeInTheDocument();
  });
});
