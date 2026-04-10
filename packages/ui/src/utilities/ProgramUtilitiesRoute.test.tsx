import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramUtilitiesRoute } from "./ProgramUtilitiesRoute";

vi.mock("./UtilitiesPage", () => ({
  UtilitiesPage: () => <div data-testid="utilities-page">Utilities</div>,
}));

describe("ProgramUtilitiesRoute", () => {
  it("renders UtilitiesPage", () => {
    render(<ProgramUtilitiesRoute />);
    expect(screen.getByTestId("utilities-page")).toBeInTheDocument();
  });
});
