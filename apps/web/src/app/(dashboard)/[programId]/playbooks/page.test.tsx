import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/playbooks",
  () => ({
    ProgramPlaybooksRoute: () => (
      <div data-testid="shared-playbooks-route">Shared Playbooks Route</div>
    ),
  }),
  { virtual: true },
);

import PlaybooksPage from "./page";

describe("PlaybooksPage wrapper", () => {
  it("renders shared ProgramPlaybooksRoute", () => {
    render(<PlaybooksPage />);

    expect(screen.getByTestId("shared-playbooks-route")).toHaveTextContent(
      "Shared Playbooks Route",
    );
  });
});
