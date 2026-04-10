import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgramWorkstreamsRoute } from "./ProgramWorkstreamsRoute";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: () => ({ _id: "prog-1", slug: "my-program" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/my-program/workstreams",
}));

vi.mock("./WorkstreamsPage", () => ({
  WorkstreamsPage: ({ programId, programSlug }: any) => (
    <div data-testid="workstreams-page">
      {programId}:{programSlug}
    </div>
  ),
}));

describe("ProgramWorkstreamsRoute", () => {
  it("renders WorkstreamsPage with resolved program", () => {
    render(<ProgramWorkstreamsRoute />);
    expect(screen.getByTestId("workstreams-page")).toHaveTextContent("prog-1:my-program");
  });
});
