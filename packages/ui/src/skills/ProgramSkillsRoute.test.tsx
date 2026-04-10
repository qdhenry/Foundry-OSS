import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./SkillsPage", () => ({
  __esModule: true,
  default: () => <div data-testid="skills-page">SkillsPage</div>,
}));

import { ProgramSkillsRoute } from "./ProgramSkillsRoute";

describe("ProgramSkillsRoute", () => {
  it("renders SkillsPage", () => {
    render(<ProgramSkillsRoute />);
    expect(screen.getByTestId("skills-page")).toBeInTheDocument();
  });
});
