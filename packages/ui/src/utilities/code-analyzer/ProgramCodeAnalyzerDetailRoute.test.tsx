import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramCodeAnalyzerDetailRoute } from "./ProgramCodeAnalyzerDetailRoute";

vi.mock("next/navigation", () => ({
  useParams: () => ({ analysisId: "analysis-1" }),
}));

vi.mock("./CodeAnalyzerDetailPage", () => ({
  CodeAnalyzerDetailPage: ({ analysisId }: { analysisId: string }) => (
    <div data-testid="detail-page">{analysisId}</div>
  ),
}));

describe("ProgramCodeAnalyzerDetailRoute", () => {
  it("renders detail page with analysisId param", () => {
    render(<ProgramCodeAnalyzerDetailRoute />);
    expect(screen.getByTestId("detail-page")).toHaveTextContent("analysis-1");
  });
});
