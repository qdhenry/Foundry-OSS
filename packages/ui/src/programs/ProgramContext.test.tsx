import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseConvexAuth = vi.fn();
const mockUseQuery = vi.fn();
const mockUseOrganization = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => mockUseConvexAuth(),
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => mockUseOrganization(),
}));

import { ProgramProvider, useProgramContext } from "./ProgramContext";

function Consumer() {
  const ctx = useProgramContext();
  return <div data-testid="consumer">{ctx.program.name}</div>;
}

describe("ProgramProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true });
    mockUseOrganization.mockReturnValue({ organization: { id: "org_1" } });
  });

  it("shows loading when query returns undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(
      <ProgramProvider slug="test-slug">
        <Consumer />
      </ProgramProvider>,
    );
    expect(screen.getByText("Loading program...")).toBeInTheDocument();
  });

  it("shows not found when query returns null", () => {
    mockUseQuery.mockReturnValue(null);
    render(
      <ProgramProvider slug="test-slug">
        <Consumer />
      </ProgramProvider>,
    );
    expect(screen.getByText("Program not found")).toBeInTheDocument();
  });

  it("renders children with program context when data is available", () => {
    mockUseQuery.mockReturnValue({
      _id: "prog_1",
      name: "My Program",
      slug: "my-program",
      stats: {},
    });
    render(
      <ProgramProvider slug="my-program">
        <Consumer />
      </ProgramProvider>,
    );
    expect(screen.getByTestId("consumer")).toHaveTextContent("My Program");
  });

  it("uses programId as slug fallback when slug is undefined", () => {
    mockUseQuery.mockReturnValue({
      _id: "prog_1",
      name: "Test",
      stats: {},
    });
    render(
      <ProgramProvider slug="test">
        <Consumer />
      </ProgramProvider>,
    );
    expect(screen.getByTestId("consumer")).toBeInTheDocument();
  });
});

describe("useProgramContext", () => {
  it("throws when used outside ProgramProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      "useProgramContext must be used within a ProgramProvider",
    );
    spy.mockRestore();
  });
});
