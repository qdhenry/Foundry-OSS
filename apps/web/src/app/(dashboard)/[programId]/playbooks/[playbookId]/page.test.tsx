import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@foundry/ui/playbooks",
  () => ({
    ProgramPlaybookDetailRoute: () => (
      <div data-testid="shared-playbook-detail-route">Shared Playbook Detail Route</div>
    ),
  }),
  { virtual: true },
);

import PlaybookDetailPage from "./page";

describe("PlaybookDetailPage wrapper", () => {
  it("renders shared ProgramPlaybookDetailRoute", () => {
    render(<PlaybookDetailPage />);

    expect(screen.getByTestId("shared-playbook-detail-route")).toHaveTextContent(
      "Shared Playbook Detail Route",
    );
  });
});
