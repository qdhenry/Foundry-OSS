import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramSprintsRoute } from "./ProgramSprintsRoute";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "test-program" }),
}));

vi.mock("../theme/useAnimations", () => ({
  useStaggerEntrance: vi.fn(),
}));

vi.mock("./SprintCard", () => ({
  SprintCard: () => <div data-testid="sprint-card" />,
}));

vi.mock("./SprintFilters", () => ({
  SprintFilters: () => <div data-testid="sprint-filters" />,
}));

describe("ProgramSprintsRoute", () => {
  it("renders heading", () => {
    render(<ProgramSprintsRoute />);
    expect(screen.getByText("Sprints")).toBeInTheDocument();
  });

  it("renders Create Sprint button", () => {
    render(<ProgramSprintsRoute />);
    expect(screen.getByText("Create Sprint")).toBeInTheDocument();
  });

  it("renders loading state when sprints undefined", () => {
    render(<ProgramSprintsRoute />);
    expect(screen.getByText("Loading sprints...")).toBeInTheDocument();
  });
});
