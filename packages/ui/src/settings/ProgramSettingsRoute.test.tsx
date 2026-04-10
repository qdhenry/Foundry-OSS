import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./SettingsPage", () => ({
  SettingsPage: () => <div data-testid="settings-page">Settings</div>,
}));

import { ProgramSettingsRoute } from "./ProgramSettingsRoute";

describe("ProgramSettingsRoute", () => {
  it("renders SettingsPage", () => {
    render(<ProgramSettingsRoute />);
    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
  });
});
