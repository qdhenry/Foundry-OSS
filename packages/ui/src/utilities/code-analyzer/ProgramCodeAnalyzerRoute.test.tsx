import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramCodeAnalyzerRoute } from "./ProgramCodeAnalyzerRoute";

vi.mock("./CodeAnalyzerPage", () => ({
  CodeAnalyzerPage: () => <div data-testid="code-analyzer-page">Analyzer</div>,
}));

describe("ProgramCodeAnalyzerRoute", () => {
  it("renders CodeAnalyzerPage", () => {
    render(<ProgramCodeAnalyzerRoute />);
    expect(screen.getByTestId("code-analyzer-page")).toBeInTheDocument();
  });
});
