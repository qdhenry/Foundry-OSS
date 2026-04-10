import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramPipelineLabRoute } from "./ProgramPipelineLabRoute";

let mockIsAuthenticated = true;
let mockIsLoading = false;
let mockOrg: any = { id: "org_1" };
let mockProgram: any;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
  }),
  useQuery: () => mockProgram,
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: mockOrg }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/test-program/pipeline-lab",
}));

vi.mock("./PipelineLabPage", () => ({
  PipelineLabPage: () => <div data-testid="pipeline-lab-page" />,
}));

describe("ProgramPipelineLabRoute", () => {
  it("shows spinner when auth is loading", () => {
    mockIsLoading = true;
    mockIsAuthenticated = false;
    const { container } = render(<ProgramPipelineLabRoute />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    mockIsLoading = false;
    mockIsAuthenticated = true;
  });

  it("shows sign in message when not authenticated", () => {
    mockIsAuthenticated = false;
    render(<ProgramPipelineLabRoute />);
    expect(screen.getByText("Sign in to load pipeline lab.")).toBeInTheDocument();
    mockIsAuthenticated = true;
  });

  it("shows org selection message when no org", () => {
    mockOrg = null;
    render(<ProgramPipelineLabRoute />);
    expect(screen.getByText("Select an organization to load pipeline lab.")).toBeInTheDocument();
    mockOrg = { id: "org_1" };
  });

  it("shows not found when program is null", () => {
    mockProgram = null;
    render(<ProgramPipelineLabRoute />);
    expect(screen.getByText("Program not found for this route.")).toBeInTheDocument();
    mockProgram = undefined;
  });

  it("renders PipelineLabPage when program resolved", () => {
    mockProgram = { _id: "prog_1", slug: "test-program" };
    render(<ProgramPipelineLabRoute />);
    expect(screen.getByTestId("pipeline-lab-page")).toBeInTheDocument();
    mockProgram = undefined;
  });
});
