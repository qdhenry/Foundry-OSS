import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/playbooks",
  () => ({
    ProgramPlaybookNewRoute: () => (
      <div data-testid="shared-playbook-new-route">Shared Playbook New Route</div>
    ),
  }),
  { virtual: true },
);

import NewPlaybookPage from "./page";

describe("NewPlaybookPage wrapper", () => {
  it("renders shared ProgramPlaybookNewRoute", () => {
    render(<NewPlaybookPage />);

    expect(screen.getByTestId("shared-playbook-new-route")).toHaveTextContent(
      "Shared Playbook New Route",
    );
  });
});
