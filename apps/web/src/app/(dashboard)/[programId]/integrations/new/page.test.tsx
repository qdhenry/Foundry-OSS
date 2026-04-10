import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/integrations",
  () => ({
    ProgramIntegrationNewRoute: () => (
      <div data-testid="shared-integration-new-route">Shared Integration New Route</div>
    ),
  }),
  { virtual: true },
);

import NewIntegrationPage from "./page";

describe("NewIntegrationPage wrapper", () => {
  it("renders shared ProgramIntegrationNewRoute", () => {
    render(<NewIntegrationPage />);

    expect(screen.getByTestId("shared-integration-new-route")).toHaveTextContent(
      "Shared Integration New Route",
    );
  });
});
