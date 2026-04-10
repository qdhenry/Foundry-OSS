import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DependencySuggestions } from "./DependencySuggestions";

const mockApprove = vi.fn().mockResolvedValue(undefined);
const mockDismiss = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn((fn: string) => {
    if (fn === "dependencyDetection:approveDependency") return mockApprove;
    if (fn === "dependencyDetection:dismissDependency") return mockDismiss;
    return vi.fn();
  }),
}));

describe("DependencySuggestions", () => {
  it("renders loading skeleton when data undefined", () => {
    const { container } = render(<DependencySuggestions programId="prog-1" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.getByText("AI-Suggested Dependencies")).toBeInTheDocument();
  });

  it("renders nothing when suggestions are empty", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const { container } = render(<DependencySuggestions programId="prog-1" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders suggestions with workstream names", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "dep-1",
        aiConfidence: 85,
        dependencyType: "blocks",
        description: "Auth must complete before billing",
        sourceWorkstream: { name: "Auth Module" },
        targetWorkstream: { name: "Billing" },
      },
    ]);

    render(<DependencySuggestions programId="prog-1" />);
    expect(screen.getByText(/Auth Module/)).toBeInTheDocument();
    expect(screen.getByText(/Billing/)).toBeInTheDocument();
    expect(screen.getByText("Auth must complete before billing")).toBeInTheDocument();
    expect(screen.getByText(/85/)).toBeInTheDocument();
    expect(screen.getByText(/confidence/)).toBeInTheDocument();
  });

  it("renders pending review count", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "dep-1",
        aiConfidence: 70,
        sourceWorkstream: { name: "A" },
        targetWorkstream: { name: "B" },
      },
      {
        _id: "dep-2",
        aiConfidence: 60,
        sourceWorkstream: { name: "C" },
        targetWorkstream: { name: "D" },
      },
    ]);

    render(<DependencySuggestions programId="prog-1" />);
    expect(screen.getByText("(2 pending review)")).toBeInTheDocument();
  });

  it("renders Approve and Dismiss buttons", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "dep-1",
        aiConfidence: 80,
        sourceWorkstream: { name: "A" },
        targetWorkstream: { name: "B" },
      },
    ]);

    render(<DependencySuggestions programId="prog-1" />);
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("calls approve mutation on Approve click", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "dep-1",
        aiConfidence: 80,
        sourceWorkstream: { name: "A" },
        targetWorkstream: { name: "B" },
      },
    ]);

    render(<DependencySuggestions programId="prog-1" />);
    await userEvent.click(screen.getByText("Approve"));
    expect(mockApprove).toHaveBeenCalledWith({ dependencyId: "dep-1" });
  });
});
