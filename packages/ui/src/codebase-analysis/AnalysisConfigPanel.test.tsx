import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisConfigPanel } from "./AnalysisConfigPanel";

describe("AnalysisConfigPanel", () => {
  it("shows no repos warning when hasRepos is false", () => {
    render(<AnalysisConfigPanel onRun={vi.fn()} isRunning={false} hasRepos={false} />);
    expect(screen.getByText("No repositories linked")).toBeInTheDocument();
  });

  it("renders preset buttons", () => {
    render(<AnalysisConfigPanel onRun={vi.fn()} isRunning={false} hasRepos={true} />);
    expect(screen.getByText("Quick")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Deep")).toBeInTheDocument();
  });

  it("renders advanced toggle", () => {
    render(<AnalysisConfigPanel onRun={vi.fn()} isRunning={false} hasRepos={true} />);
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("shows advanced config when toggled", async () => {
    const user = userEvent.setup();
    render(<AnalysisConfigPanel onRun={vi.fn()} isRunning={false} hasRepos={true} />);
    await user.click(screen.getByText("Advanced"));
    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(screen.getByText("Directory filter")).toBeInTheDocument();
    expect(screen.getByText("Confidence threshold")).toBeInTheDocument();
  });

  it("renders analyze button", () => {
    render(<AnalysisConfigPanel onRun={vi.fn()} isRunning={false} hasRepos={true} />);
    expect(screen.getByText("Analyze Codebase")).toBeInTheDocument();
  });

  it("shows analyzing state when running", () => {
    render(<AnalysisConfigPanel onRun={vi.fn()} isRunning={true} hasRepos={true} />);
    expect(screen.getByText("Analyzing...")).toBeInTheDocument();
  });
});
