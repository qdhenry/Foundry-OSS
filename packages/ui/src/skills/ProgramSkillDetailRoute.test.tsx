import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./SkillDetailPage", () => ({
  __esModule: true,
  default: () => <div data-testid="skill-detail-page">SkillDetailPage</div>,
}));

import { ProgramSkillDetailRoute } from "./ProgramSkillDetailRoute";

describe("ProgramSkillDetailRoute", () => {
  it("renders SkillDetailPage", () => {
    render(<ProgramSkillDetailRoute />);
    expect(screen.getByTestId("skill-detail-page")).toBeInTheDocument();
  });
});
