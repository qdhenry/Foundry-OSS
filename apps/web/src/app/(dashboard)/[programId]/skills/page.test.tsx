import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/skills",
  () => ({
    ProgramSkillsRoute: () => <div data-testid="shared-skills-route">Shared Skills Route</div>,
  }),
  { virtual: true },
);

import SkillsPage from "./page";

describe("SkillsPage wrapper", () => {
  it("renders shared ProgramSkillsRoute", () => {
    render(<SkillsPage />);

    expect(screen.getByTestId("shared-skills-route")).toHaveTextContent("Shared Skills Route");
  });
});
