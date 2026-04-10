import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/skills",
  () => ({
    ProgramSkillNewRoute: () => (
      <div data-testid="shared-skill-new-route">Shared Skill New Route</div>
    ),
  }),
  { virtual: true },
);

import NewSkillPage from "./page";

describe("NewSkillPage wrapper", () => {
  it("renders shared ProgramSkillNewRoute", () => {
    render(<NewSkillPage />);

    expect(screen.getByTestId("shared-skill-new-route")).toHaveTextContent(
      "Shared Skill New Route",
    );
  });
});
