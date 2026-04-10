import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./DesignPage", () => ({
  DesignPage: () => <div data-testid="design-page">Design</div>,
}));

import { ProgramDesignRoute } from "./ProgramDesignRoute";

describe("ProgramDesignRoute", () => {
  it("renders DesignPage", () => {
    render(<ProgramDesignRoute />);
    expect(screen.getByTestId("design-page")).toBeInTheDocument();
  });
});
