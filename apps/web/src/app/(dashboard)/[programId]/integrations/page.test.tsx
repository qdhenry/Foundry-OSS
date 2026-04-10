import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/integrations",
  () => ({
    ProgramIntegrationsRoute: () => (
      <div data-testid="shared-integrations-route">Shared Integrations Route</div>
    ),
  }),
  { virtual: true },
);

import IntegrationsPage from "./page";

describe("IntegrationsPage wrapper", () => {
  it("renders shared ProgramIntegrationsRoute", () => {
    render(<IntegrationsPage />);

    expect(screen.getByTestId("shared-integrations-route")).toHaveTextContent(
      "Shared Integrations Route",
    );
  });
});
