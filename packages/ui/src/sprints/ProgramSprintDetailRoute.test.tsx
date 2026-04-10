import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramSprintDetailRoute } from "./ProgramSprintDetailRoute";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ sprintId: "sprint_1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "test-program" }),
}));

vi.mock("./BranchStrategyPanel", () => ({
  BranchStrategyPanel: () => <div data-testid="branch-strategy" />,
}));

vi.mock("./SprintCapacityPlanner", () => ({
  SprintCapacityPlanner: () => <div data-testid="capacity-planner" />,
}));

describe("ProgramSprintDetailRoute", () => {
  it("renders loading state when sprint is undefined", () => {
    render(<ProgramSprintDetailRoute />);
    expect(screen.getByText("Loading sprint...")).toBeInTheDocument();
  });
});
