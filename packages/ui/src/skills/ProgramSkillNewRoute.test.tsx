import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./NewSkillPage", () => ({
  __esModule: true,
  default: () => <div data-testid="new-skill-page">NewSkillPage</div>,
}));

import { ProgramSkillNewRoute } from "./ProgramSkillNewRoute";

describe("ProgramSkillNewRoute", () => {
  it("renders NewSkillPage", () => {
    render(<ProgramSkillNewRoute />);
    expect(screen.getByTestId("new-skill-page")).toBeInTheDocument();
  });
});
