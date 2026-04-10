import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisLauncher } from "./AnalysisLauncher";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

describe("AnalysisLauncher", () => {
  it("renders heading", () => {
    render(<AnalysisLauncher programId="prog-1" orgId="org-1" />);
    expect(screen.getByText("New Analysis")).toBeInTheDocument();
  });

  it("renders source mode toggles", () => {
    render(<AnalysisLauncher programId="prog-1" orgId="org-1" />);
    expect(screen.getByText("Linked Repository")).toBeInTheDocument();
    expect(screen.getByText("Manual URL")).toBeInTheDocument();
  });

  it("shows URL input in manual mode", () => {
    render(<AnalysisLauncher programId="prog-1" orgId="org-1" />);
    expect(screen.getByPlaceholderText("https://github.com/owner/repo")).toBeInTheDocument();
  });

  it("shows linked repo fallback when switched", async () => {
    const user = userEvent.setup();
    render(<AnalysisLauncher programId="prog-1" orgId="org-1" />);
    await user.click(screen.getByText("Linked Repository"));
    expect(screen.getByText("No linked repositories")).toBeInTheDocument();
  });

  it("shows validation error for invalid URL", async () => {
    const user = userEvent.setup();
    render(<AnalysisLauncher programId="prog-1" orgId="org-1" />);
    await user.type(screen.getByPlaceholderText("https://github.com/owner/repo"), "not-a-url");
    expect(screen.getByText(/Enter a valid GitHub repository URL/)).toBeInTheDocument();
  });

  it("analyze button disabled initially", () => {
    render(<AnalysisLauncher programId="prog-1" orgId="org-1" />);
    expect(screen.getByText("Analyze Repository")).toBeDisabled();
  });
});
