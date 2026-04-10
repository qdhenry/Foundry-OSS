import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/settings", () => ({
  ProgramSettingsRoute: () => <div data-testid="shared-settings-route">Shared Settings Route</div>,
}));

import ProgramSettingsPage from "./page";

describe("ProgramSettingsPage wrapper", () => {
  it("renders shared ProgramSettingsRoute", () => {
    render(<ProgramSettingsPage />);

    expect(screen.getByTestId("shared-settings-route")).toHaveTextContent("Shared Settings Route");
  });
});
