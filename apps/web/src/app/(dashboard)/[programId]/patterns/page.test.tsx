import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/patterns", () => ({
  ProgramPatternsRoute: () => <div data-testid="shared-patterns-route">Shared Patterns Route</div>,
}));

import ProgramPatternsPage from "./page";

describe("ProgramPatternsPage wrapper", () => {
  it("renders shared ProgramPatternsRoute", () => {
    render(<ProgramPatternsPage />);

    expect(screen.getByTestId("shared-patterns-route")).toHaveTextContent("Shared Patterns Route");
  });
});
