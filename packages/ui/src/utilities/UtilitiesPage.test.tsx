import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UtilitiesPage } from "./UtilitiesPage";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../programs/ProgramContext", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

describe("UtilitiesPage", () => {
  it("renders page heading", () => {
    render(<UtilitiesPage />);
    expect(screen.getByText("Utilities")).toBeInTheDocument();
  });

  it("renders Code Analyzer utility card", () => {
    render(<UtilitiesPage />);
    expect(screen.getByText("Code Analyzer")).toBeInTheDocument();
  });

  it("links to code analyzer with correct slug", () => {
    render(<UtilitiesPage />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/test-program/utilities/code-analyzer");
  });
});
