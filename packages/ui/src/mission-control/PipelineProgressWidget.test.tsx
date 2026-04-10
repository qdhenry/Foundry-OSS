import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineProgressWidget } from "./PipelineProgressWidget";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("../programs/ProgramContext", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

describe("PipelineProgressWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    render(<PipelineProgressWidget programId="prog-1" />);
    expect(screen.getByText("Pipeline Progress")).toBeInTheDocument();
  });

  it("renders empty state when total is 0", async () => {
    const { useQuery } = await import("convex/react");
    const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;
    mockUseQuery.mockImplementation((_fn: any, args: any) => {
      if (args?.programId) {
        return { counts: {}, total: 0, progress: 0 };
      }
      return [];
    });

    render(<PipelineProgressWidget programId="prog-1" />);
    expect(screen.getByText("No requirements in the pipeline yet.")).toBeInTheDocument();
  });

  it("renders progress percentage when data available", async () => {
    const { useQuery } = await import("convex/react");
    const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;
    mockUseQuery.mockImplementation((_fn: any, args: any) => {
      if (args?.workstreamId) {
        return { counts: { discovery: 5 }, total: 5, progress: 30 };
      }
      if (args?.programId) {
        return {
          counts: { discovery: 10, requirement: 5, implementation: 3 },
          total: 18,
          progress: 45,
        };
      }
      return [];
    });

    render(<PipelineProgressWidget programId="prog-1" />);
    expect(screen.getByText("45%")).toBeInTheDocument();
  });
});
