import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/integrations",
  () => ({
    ProgramIntegrationDetailRoute: () => (
      <div data-testid="shared-integration-detail-route">Shared Integration Detail Route</div>
    ),
  }),
  { virtual: true },
);

import IntegrationDetailPage from "./page";

describe("IntegrationDetailPage wrapper", () => {
  it("renders shared ProgramIntegrationDetailRoute", () => {
    render(<IntegrationDetailPage />);

    expect(screen.getByTestId("shared-integration-detail-route")).toHaveTextContent(
      "Shared Integration Detail Route",
    );
  });
});
