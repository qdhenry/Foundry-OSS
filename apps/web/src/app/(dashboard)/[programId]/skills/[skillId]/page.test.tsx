import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/skills",
  () => ({
    ProgramSkillDetailRoute: () => (
      <div data-testid="shared-skill-detail-route">Shared Skill Detail Route</div>
    ),
  }),
  { virtual: true },
);

import SkillDetailPage from "./page";

describe("SkillDetailPage wrapper", () => {
  it("renders shared ProgramSkillDetailRoute", () => {
    render(<SkillDetailPage />);

    expect(screen.getByTestId("shared-skill-detail-route")).toHaveTextContent(
      "Shared Skill Detail Route",
    );
  });
});
